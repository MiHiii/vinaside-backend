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
    origin: 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/ws/messages',
  path: '/socket.io',
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
        `Socket message received from ${data.sender_id} to ${data.receiver_id}`,
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

  // Method public để emit message từ controller
  emitNewMessage(formattedMessage: unknown, receiverId: string): void {
    const receiverRoom = buildUserRoom(receiverId);

    this.server.to(receiverRoom).emit('new_message', formattedMessage);
    this.logger.log(`Emitted new_message to ${receiverRoom}`);
  }

  // Method public để emit reaction update
  emitReactionUpdate(message: Message, receiverId: string): void {
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
}
