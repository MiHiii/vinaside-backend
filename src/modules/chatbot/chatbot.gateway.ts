import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatbotService } from './chatbot.service';
import { PromptBuilder } from './prompt-builder';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatbotMessage } from './schemas/chatbot-message.schema';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/ws/chatbot',
  path: '/socket.io',
})
export class ChatbotGateway {
  @WebSocketServer()
  server: Server;
  private logger: Logger = new Logger('ChatbotGateway');
  private connectedUsers: Map<string, { userId: string; socketId: string }> =
    new Map();

  constructor(
    private readonly chatbotService: ChatbotService,
    @InjectModel(ChatbotMessage.name)
    private chatbotMessageModel: Model<ChatbotMessage>,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    // Có thể lấy userId từ handshake nếu cần
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
    await client.join(`chatbot_user_${userId}`);
    this.logger.log(
      `User ${userId} joined chatbot room with socket ${client.id}`,
    );
    this.server.emit('user_online', { userId });
    return { success: true, message: 'Joined chatbot room successfully' };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { userId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Build prompt đúng format cho Gemini
      const prompt = PromptBuilder.buildPrompt(data.message);
      const reply = await this.chatbotService.askGemini(prompt);

      // Lưu tin nhắn vào database
      await this.chatbotMessageModel.create({
        content: data.message,
        user_id: data.userId,
        reply: reply,
      });

      // Gửi lại cho người gửi
      client.emit('receive_message', { message: reply });
      // Gửi tới room nếu cần
      this.server.to(`chatbot_user_${data.userId}`).emit('new_message', {
        content: data.message,
        reply,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Gemini API error:', error);
      client.emit('receive_message', {
        message: 'Đã xảy ra lỗi khi xử lý yêu cầu.',
      });
    }
  }
}
