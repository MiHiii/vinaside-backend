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

// ============= TYPE DEFINITIONS =============

interface ConversationUpdateData {
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
}

interface ConversationUpdateV2Data {
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
}

interface ConversationListUpdateData {
  conversations: unknown[];
  updatedBy: string;
  ui_for: string;
  timestamp: string;
  type: string;
}

interface MessageData {
  _id?: string;
  content?: string;
  sender_id?: string;
  sent_at?: Date | string;
  is_read?: string;
  [key: string]: unknown;
}

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

    // Check if server is ready after initialization
    setTimeout(() => {
      const isReady = this.isServerReady();
      this.logger.log(`WebSocket Gateway ready status: ${isReady}`);

      if (!isReady) {
        this.logger.warn('WebSocket Gateway not ready after initialization');
      }
    }, 1000);
  }

  isServerReady(): boolean {
    const isReady = !!(
      this.server &&
      this.server.sockets &&
      this.server.sockets.adapter &&
      this.server.sockets.adapter.rooms
    );

    console.log(`🔍 [Server Ready Check] Server ready: ${isReady}`, {
      hasServer: !!this.server,
      hasSockets: !!this.server?.sockets,
      hasAdapter: !!this.server?.sockets?.adapter,
      hasRooms: !!this.server?.sockets?.adapter?.rooms,
    });

    return isReady;
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
    @MessageBody() data: { userId: string; role?: string },
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

  @SubscribeMessage('admin_join_all_rooms')
  async handleAdminJoinAllRooms(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message: string }> {
    const { userId } = data;

    // Join admin room
    await client.join(buildUserRoom(userId));

    // Join admin broadcast room for all conversations
    await client.join('admin_broadcast');

    this.connectedUsers.set(userId, {
      userId,
      socketId: client.id,
    });

    this.logger.log(
      `Admin ${userId} joined all rooms with socket ${client.id}`,
    );
    this.server.emit('admin_online', { userId });
    return { success: true, message: 'Admin joined all rooms successfully' };
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
    const maxRetries = 5;
    const retryDelay = 200; // ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if server is ready
        if (!this.isServerReady()) {
          console.log(`🔍 Server not ready, attempt ${attempt}/${maxRetries}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.warn('WebSocket server not ready, skipping emit');
            return; // Don't throw error, just skip
          }
        }

        const receiverRoom = buildUserRoom(receiverId);
        const isUserOnline = this.isUserOnline(receiverId);

        console.log(
          `🔍 Debug: About to emit new_message to room ${receiverRoom} for user ${receiverId}`,
        );
        console.log(`🔍 Debug: User online status: ${isUserOnline}`);

        // Emit với cấu trúc chuẩn cho frontend
        const messageData = formattedMessage as Record<string, unknown>;
        this.server.to(receiverRoom).emit('new_message', {
          content: (messageData?.content as string) || '',
          senderId: (messageData?.sender_id as string) || '',
          receiverId: receiverId,
          sent_at: (messageData?.sent_at as string) || new Date().toISOString(),
          is_read: (messageData?.is_read as string) || 'sent',
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
          console.warn(
            'Failed to emit new message after all retries, skipping',
          );
          return; // Don't throw error, just skip
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

  emitMessageRecalledToAdminBroadcast(message: MessageData): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting message recall to admin_broadcast room:',
      {
        messageId: (message as any)._id as string,
      },
    );

    this.server.to('admin_broadcast').emit('message_recalled', {
      message,
      type: 'message_recalled',
    });
  }

  emitConversationListUpdateToAdminBroadcast(
    data: ConversationListUpdateData,
  ): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting conversation list update to admin_broadcast room:',
      {
        ui_for: (data as any).ui_for as string,
        conversationCount: ((data as any).conversations?.length as number) || 0,
      },
    );

    this.server.to('admin_broadcast').emit('conversation_list_update', {
      ...data,
      type: 'conversation_list_update',
    });
  }

  emitConversationListUpdateToGuest(data: ConversationListUpdateData): void {
    console.log('🔍 [Guest] Emitting conversation list update to guest:', {
      ui_for: (data as any).ui_for as string,
      conversationCount: ((data as any).conversations?.length as number) || 0,
      userId: (data as any).updatedBy as string,
    });

    const userRoom = buildUserRoom((data as any).updatedBy as string);
    const isUserOnline = this.isUserOnline((data as any).updatedBy as string);

    console.log(`🔍 [Guest] User room: ${userRoom}, Online: ${isUserOnline}`);

    this.server.to(userRoom).emit('conversation_list_update', {
      ...data,
      type: 'conversation_list_update',
    });

    // Also emit to all connected clients for debugging
    this.server.emit('debug_conversation_update', {
      targetUser: (data as any).updatedBy as string,
      userRoom,
      isOnline: isUserOnline,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewMessageToAdminBroadcast(
    message: MessageData,
    conversationId: string,
    propertyId: string,
    guestId: string,
  ): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting new message to admin_broadcast room:',
      {
        messageId: (message as any)._id as string,
        conversationId,
        propertyId,
        guestId,
      },
    );

    this.server.to('admin_broadcast').emit('new_message', {
      ...message,
      conversationId,
      propertyId,
      guestId,
      type: 'new_message',
    });
  }

  emitConversationUpdateToAdminBroadcast(data: ConversationUpdateData): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting conversation update to admin_broadcast room:',
      {
        conversationId: (data as any).conversationId as string,
        messageCount: (data as any).messageCount as number,
      },
    );

    this.server.to('admin_broadcast').emit('conversation_update', {
      ...data,
      type: 'conversation_update',
    });
  }

  emitConversationUpdateV2ToAdminBroadcast(
    data: ConversationUpdateV2Data,
  ): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting conversation update V2 to admin_broadcast room:',
      {
        conversationId: (data as any).conversationId as string,
        lastMessageAt: (data as any).lastMessageAt as Date | string | null,
        unreadCount: (data as any).unreadCount as number,
      },
    );

    this.server.to('admin_broadcast').emit('conversation_update_v2', {
      ...data,
      type: 'conversation_update_v2',
    });
  }

  emitReactionUpdateToAdminBroadcast(message: MessageData): void {
    console.log(
      '🔍 [Admin Broadcast] Emitting reaction update to admin_broadcast room:',
      {
        messageId: (message as any)._id as string,
      },
    );

    this.server.to('admin_broadcast').emit('reaction_update', {
      message,
      type: 'reaction_update',
    });
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

  // Debug method to check connection status
  debugConnectionStatus(userId: string): void {
    const isOnline = this.isUserOnline(userId);
    const userRoom = buildUserRoom(userId);
    const connectedUsers = Array.from(this.connectedUsers.keys());

    console.log(`🔍 [Debug] Connection status for user ${userId}:`, {
      isOnline,
      userRoom,
      totalConnectedUsers: this.connectedUsers.size,
      connectedUsers,
      serverReady: this.isServerReady(),
    });
  }

  // Method to wait for server to be ready
  async waitForServerReady(maxWaitTime: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100; // ms

    while (Date.now() - startTime < maxWaitTime) {
      if (this.isServerReady()) {
        console.log('🔍 [Server Ready] WebSocket server is ready');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    console.warn('🔍 [Server Ready] WebSocket server not ready after timeout');
    return false;
  }
}
