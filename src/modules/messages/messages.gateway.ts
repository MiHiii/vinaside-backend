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
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageStatus } from './schemas/message.schema';

interface ConnectedUser {
  userId: string;
  socketId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagesGateway');
  private connectedUsers: Map<string, ConnectedUser> = new Map();

  constructor(private readonly messagesService: MessagesService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove user from connected users when they disconnect
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
  ) {
    const { userId } = data;
    
    // Store user connection
    this.connectedUsers.set(userId, {
      userId,
      socketId: client.id,
    });
    
    // Join user to their personal room
    await client.join(`user_${userId}`);
    
    this.logger.log(`User ${userId} joined room with socket ${client.id}`);
    
    // Notify others that user is online
    this.server.emit('user_online', { userId });
    
    return { success: true, message: 'Joined room successfully' };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Save message to database
      const message = await this.messagesService.create({
        ...data,
        is_read: MessageStatus.SENT,
      });

      // Populate message data
      const populatedMessage = await this.messagesService.findOne((message as any)._id.toString());

      // Send to sender
      client.emit('message_sent', populatedMessage);

      // Send to receiver if they're online
      const receiverConnection = this.connectedUsers.get(data.receiver_id);
      if (receiverConnection) {
        this.server.to(`user_${data.receiver_id}`).emit('new_message', populatedMessage);
        
        // Mark as delivered
        await this.messagesService.update((message as any)._id.toString(), {
          is_read: MessageStatus.DELIVERED,
        });
      }

      this.logger.log(`Message sent from ${data.sender_id} to ${data.receiver_id}`);
      
      return { success: true, message: populatedMessage };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { messageId, userId } = data;
      
      // Update message status
      const updatedMessage = await this.messagesService.markAsRead(messageId);
      
      if (updatedMessage) {
        // Notify sender that message was read
        const senderConnection = this.connectedUsers.get(updatedMessage.sender_id.toString());
        if (senderConnection) {
          this.server.to(`user_${updatedMessage.sender_id}`).emit('message_read', {
            messageId,
            readBy: userId,
          });
        }
      }
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error marking message as read:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('mark_conversation_as_read')
  async handleMarkConversationAsRead(
    @MessageBody() data: { userId: string; otherUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { userId, otherUserId } = data;
      
      // Mark all messages in conversation as read
      await this.messagesService.markConversationAsRead(userId, otherUserId);
      
      // Notify other user that conversation was read
      const otherUserConnection = this.connectedUsers.get(otherUserId);
      if (otherUserConnection) {
        this.server.to(`user_${otherUserId}`).emit('conversation_read', {
          readBy: userId,
        });
      }
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error marking conversation as read:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() data: { senderId: string; receiverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { senderId, receiverId } = data;
    
    // Notify receiver that sender is typing
    const receiverConnection = this.connectedUsers.get(receiverId);
    if (receiverConnection) {
      this.server.to(`user_${receiverId}`).emit('user_typing', {
        userId: senderId,
        isTyping: true,
      });
    }
    
    return { success: true };
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { senderId: string; receiverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { senderId, receiverId } = data;
    
    // Notify receiver that sender stopped typing
    const receiverConnection = this.connectedUsers.get(receiverId);
    if (receiverConnection) {
      this.server.to(`user_${receiverId}`).emit('user_typing', {
        userId: senderId,
        isTyping: false,
      });
    }
    
    return { success: true };
  }

  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUserIds = Array.from(this.connectedUsers.keys());
    client.emit('online_users', { users: onlineUserIds });
    return { success: true };
  }

  // Helper method to send notification to user
  async sendNotificationToUser(userId: string, notification: any) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      this.server.to(`user_${userId}`).emit('notification', notification);
    }
  }

  // Helper method to check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
