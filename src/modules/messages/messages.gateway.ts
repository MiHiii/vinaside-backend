import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SocketMessageDto } from './dto/socket-message.dto';
import { MessageStatus, Message } from './schemas/message.schema';
import { ConnectedUser } from './interfaces/message.interface';
import {
  extractUserIdFromAuth,
  handleSocketError,
  buildUserRoom,
} from './utils/message.util';
import { Types } from 'mongoose';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'https://vinaside.com',
      'https://www.vinaside.com',
      'https://vinaside-frontend.vercel.app',
      'https://vinaside-backend.vercel.app',
    ],
    credentials: true,
  },
  namespace: '/ws/messages',
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagesGateway');
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  isServerReady(): boolean {
    return !!(
      this.server &&
      this.server.sockets &&
      this.server.sockets.adapter
    );
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    const userId = extractUserIdFromAuth(client.handshake.auth);

    if (userId) {
      this.connectedUsers.set(userId, {
        userId,
        socketId: client.id,
      });
      void client.join(buildUserRoom(userId));
      this.server.emit('user_online', { userId });
      this.logger.log(`Auto joined ${buildUserRoom(userId)} from handshake`);

      // Send connection confirmation
      client.emit('connection_confirmed', {
        userId,
        room: buildUserRoom(userId),
        timestamp: new Date().toISOString(),
      });
    } else {
      this.logger.warn(`Client connected without valid userId: ${client.id}`);
      client.emit('connection_error', {
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    for (const [userId, user] of this.connectedUsers.entries()) {
      if (user.socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.server.emit('user_offline', { userId });
        break;
      }
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message: string }> {
    const { userId } = data;
    this.connectedUsers.set(userId, {
      userId,
      socketId: client.id,
    });
    await client.join(buildUserRoom(userId));
    this.logger.log(`User ${userId} joined room with socket ${client.id}`);
    this.server.emit('user_online', { userId });
    return { success: true, message: 'Joined room successfully' };
  }

  @SubscribeMessage('send_message')
  handleSendMessage(
    @MessageBody() data: SocketMessageDto,
    @ConnectedSocket() client: Socket,
  ): { success: boolean; message?: string; error?: string } {
    try {
      // Gateway chỉ handle socket events, logic tạo tin nhắn sẽ được handle ở HTTP API
      this.logger.log(
        `📨 Socket message received from ${data.sender_id} to ${data.receiver_id}`,
      );

      // Gửi lại cho người gửi
      client.emit('message_sent', {
        content: data.content,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        sent_at: new Date().toISOString(),
        is_read: MessageStatus.SENT,
      });

      // Emit tin nhắn tới receiver room
      const receiverRoom = buildUserRoom(data.receiver_id);
      this.server.to(receiverRoom).emit('new_message', {
        content: data.content,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        sent_at: new Date().toISOString(),
        is_read: MessageStatus.SENT,
      });

      return { success: true, message: 'Message broadcasted via socket' };
    } catch (error: unknown) {
      this.logger.error('Error in socket message:', error);
      return { success: false, error: handleSocketError(error) };
    }
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Debug listener để kiểm tra new_message events
  @SubscribeMessage('new_message')
  handleNewMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log('📨 New message received via socket:', data);
    console.log('📨 Client ID:', client.id);
    console.log('📨 Client rooms:', Array.from(client.rooms));
  }

  // Debug listener để kiểm tra reaction_update events
  @SubscribeMessage('reaction_update')
  handleReactionUpdate(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log('😀 Reaction update received via socket:', data);
    console.log('😀 Client ID:', client.id);
    console.log('😀 Client rooms:', Array.from(client.rooms));
  }

  // Method public để emit message từ controller
  async emitNewMessage(
    formattedMessage: unknown,
    receiverId: string,
  ): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 100; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if server is ready
        if (!this.isServerReady()) {
          console.log(`🔍 Server not ready, attempt ${attempt}/${maxRetries}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            throw new Error('WebSocket server not ready after retries');
          }
        }

        const receiverRoom = buildUserRoom(receiverId);
        const isUserOnline = this.isUserOnline(receiverId);

        console.log(
          `🔍 Debug: About to emit new_message to room ${receiverRoom} for user ${receiverId}`,
        );
        console.log(`🔍 Debug: User online status: ${isUserOnline}`);

        // Emit với cấu trúc chuẩn cho frontend
        this.server.to(receiverRoom).emit('new_message', {
          content: (formattedMessage as any)?.content || '',
          senderId: (formattedMessage as any)?.sender_id || '',
          receiverId: receiverId,
          sent_at:
            (formattedMessage as any)?.sent_at || new Date().toISOString(),
          is_read: (formattedMessage as any)?.is_read || 'sent',
          message: formattedMessage, // Giữ nguyên để backward compatibility
          timestamp: new Date().toISOString(),
          isUserOnline,
        });

        this.logger.log(
          `📨 Emitted new_message to ${receiverRoom}, user online: ${isUserOnline}`,
        );
        return; // Success, exit retry loop
      } catch (error) {
        console.error(`🔍 Attempt ${attempt}/${maxRetries} failed:`, error);
        if (attempt === maxRetries) {
          this.logger.error(
            'Error emitting new message after all retries:',
            error,
          );
          throw error; // Re-throw để service có thể handle
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Method public để emit reaction update
  emitReactionUpdate(message: Message, receiverId: string): void {
    try {
      if (!this.isServerReady()) {
        console.log('🔍 Server not ready for reaction update');
        return;
      }

      const receiverRoom = buildUserRoom(receiverId);

      // Format reactions với emoji mapping
      const emojiMap = {
        like: '👍',
        love: '❤️',
        laugh: '😂',
        wow: '😮',
        sad: '😢',
        angry: '😡',
      };

      const formattedReactions = message.reactions.map((reaction) => {
        // Type assertion with proper interface
        const populatedUser = reaction.user_id as unknown as {
          _id?: Types.ObjectId;
          username?: string;
          name?: string;
          avatar_url?: string;
        };

        return {
          userId:
            populatedUser?._id?.toString() ||
            (reaction.user_id as unknown as Types.ObjectId)?.toString() ||
            'unknown',
          username:
            populatedUser?.username || populatedUser?.name || 'Unknown User',
          avatar_url: populatedUser?.avatar_url || null,
          type: reaction.type,
          emoji: emojiMap[reaction.type] || '👍',
          created_at:
            reaction.created_at?.toISOString() || new Date().toISOString(),
        };
      });

      this.server.to(receiverRoom).emit('reaction_update', {
        messageId: message._id?.toString(),
        reactions: formattedReactions,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Emitted reaction_update to ${receiverRoom}`);
    } catch (error) {
      this.logger.error('Error emitting reaction update:', error);
    }
  }

  // V2: emit cập nhật conversation theo conversationId và unreadCount
  emitConversationUpdateV2(
    userId: string,
    payload: {
      conversationId: string;
      lastMessage: {
        _id: string;
        content: string;
        sender_id: string;
        sender_role: 'guest' | 'staff' | 'admin';
        sent_at: Date | string;
        is_read: 'sent' | 'delivered' | 'read';
      } | null;
      lastMessageAt: Date | string | null;
      unreadCount: number;
    },
  ): void {
    try {
      const userRoom = buildUserRoom(userId);
      this.server.to(userRoom).emit('conversation_update', payload);
      this.logger.log(`Emitted conversation_update (v2) to ${userRoom}`);
    } catch (error) {
      this.logger.error('Failed to emit conversation update v2:', error);
    }
  }

  // Legacy emitConversationUpdate removed in favor of emitConversationUpdateV2

  // Method public để emit conversation update for realtime API
  emitConversationUpdate(
    userId: string,
    payload: {
      conversationId: string;
      messages: any[];
      updatedBy: string;
      timestamp: string;
      messageCount: number;
    },
  ): void {
    try {
      const userRoom = buildUserRoom(userId);
      this.server.to(userRoom).emit('conversation_updated', payload);
      this.logger.log(
        `Emitted conversation_updated to ${userRoom} for conversation ${payload.conversationId}`,
      );
    } catch (error) {
      this.logger.error('Failed to emit conversation update:', error);
    }
  }

  // Method public để emit message recalled event
  emitMessageRecalled(message: Message, userId: string): void {
    try {
      const userRoom = buildUserRoom(userId);
      this.server.to(userRoom).emit('message_recalled', {
        messageId: message._id,
        content: message.content,
        recalled_at: message.recalled_at,
      });
      this.logger.log(`Message recall notification sent to ${userRoom}`);
    } catch (error) {
      this.logger.error('Failed to emit message recall notification:', error);
    }
  }

  emitPropertyMessage(message: Message, propertyId: string): void {
    try {
      const propertyRoom = `property_${propertyId}`;
      this.server.to(propertyRoom).emit('property_message', {
        messageId: message._id,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        property_id: message.property_id,
        content: message.content,
        sent_at: message.sent_at,
        is_read: message.is_read,
      });
      this.logger.log(`Property message notification sent to ${propertyRoom}`);
    } catch (error) {
      this.logger.error('Failed to emit property message notification:', error);
    }
  }

  // Getter để có thể access server từ controller nếu cần
  get socketServer(): Server {
    return this.server;
  }

  // Method để get connection status
  getConnectionStatus(): {
    totalConnections: number;
    connectedUsers: Array<{ userId: string; socketId: string }>;
  } {
    return {
      totalConnections: this.connectedUsers.size,
      connectedUsers: Array.from(this.connectedUsers.entries()).map(
        ([userId, user]) => ({
          userId,
          socketId: user.socketId,
        }),
      ),
    };
  }

  // Method để force disconnect a user
  forceDisconnectUser(userId: string): void {
    const user = this.connectedUsers.get(userId);
    if (user) {
      const socket = this.server.sockets.sockets.get(user.socketId);
      if (socket) {
        socket.disconnect();
        this.logger.log(`Force disconnected user: ${userId}`);
      }
      this.connectedUsers.delete(userId);
    }
  }
}
