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
    origin: 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/ws/messages',
  path: '/socket.io'   // ✅ thêm dòng này để khớp với client
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

    // ✅ Nếu frontend gửi token, ta có thể decode và join luôn room
    const { userId } = client.handshake.auth;
    if (userId) {
      this.connectedUsers.set(userId, {
        userId,
        socketId: client.id,
      });
      client.join(`user_${userId}`);
      this.server.emit('user_online', { userId });
      this.logger.log(`Auto joined user_${userId} from handshake`);
    }
  }

  handleDisconnect(client: Socket) {
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
  async handleJoinRoom(@MessageBody() data: { userId: string }, @ConnectedSocket() client: Socket) {
    const { userId } = data;
    this.connectedUsers.set(userId, {
      userId,
      socketId: client.id,
    });
    await client.join(`user_${userId}`);
    this.logger.log(`User ${userId} joined room with socket ${client.id}`);
    this.server.emit('user_online', { userId });
    return { success: true, message: 'Joined room successfully' };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@MessageBody() data: CreateMessageDto, @ConnectedSocket() client: Socket) {
    try {
      const message = await this.messagesService.create({
        ...data,
        is_read: MessageStatus.SENT,
      });

      const populatedMessage = await this.messagesService.findOne((message as any)._id.toString());

      const formattedMessage = populatedMessage && {
        _id: populatedMessage._id?.toString(),
        content: populatedMessage.content,
        senderId: typeof populatedMessage.sender_id === 'object' ? populatedMessage.sender_id._id?.toString() : populatedMessage.sender_id,
        receiverId: typeof populatedMessage.receiver_id === 'object' ? populatedMessage.receiver_id._id?.toString() : populatedMessage.receiver_id,
        sent_at: populatedMessage.sent_at ? new Date(populatedMessage.sent_at).toISOString() : null,
        is_read: populatedMessage.is_read,
      };

      // Gửi lại cho người gửi
      client.emit('message_sent', formattedMessage);

      // Gửi tới người nhận nếu họ đang online
      const receiverRoom = `user_${data.receiver_id}`;
      this.server.to(receiverRoom).emit('new_message', formattedMessage);

      // Đánh dấu là delivered nếu receiver online
      if (this.isUserOnline(data.receiver_id)) {
        await this.messagesService.update((message as any)._id.toString(), {
          is_read: MessageStatus.DELIVERED,
        });
      }

      this.logger.log(`Message sent from ${data.sender_id} to ${data.receiver_id}`);
      return { success: true, message: formattedMessage };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}