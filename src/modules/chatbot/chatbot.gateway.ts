import { detectIntent, STATIC_RESPONSES } from './intent-rules';
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
      let listingsText = '';
      let matchedListing: any = null;

      // Phát hiện intent trước
      const intent = detectIntent(data.message);
      // Nếu là intent trả lời tĩnh thì trả về luôn
      if (
        intent === 'greeting' ||
        intent === 'goodbye' ||
        intent === 'ask_voucher'
      ) {
        client.emit('receive_message', { message: STATIC_RESPONSES[intent] });
        return;
      }

      // Nếu hỏi phòng giá rẻ nhất thì trả về luôn, không cần gọi Gemini
      if (intent === 'ask_cheapest_room') {
        try {
          const axios = (await import('axios')).default;
          const { data: internalData } = await axios.get(
            'http://localhost:8080/api/v1/internal-data',
          );
          const listings = internalData?.data?.listings || [];
          if (listings.length === 0) {
            client.emit('receive_message', {
              message: 'Không có dữ liệu phòng.',
            });
            return;
          }
          // Tìm phòng giá rẻ nhất
          const cheapest = listings.reduce(
            (min: any, cur: any) =>
              cur.price_per_night < min.price_per_night ? cur : min,
            listings[0],
          );
          let msg = `Phòng giá rẻ nhất là: ${cheapest.title}\nGiá: ${cheapest.price_per_night}đ/đêm\nMô tả: ${cheapest.description}`;
          if (cheapest.images && cheapest.images.length > 0) {
            msg += `\nHình ảnh: ${cheapest.images[0]}`;
          }
          client.emit('receive_message', { message: msg });
        } catch {
          client.emit('receive_message', {
            message: 'Không lấy được dữ liệu phòng.',
          });
        }
        return;
      }

      // Gọi API nội bộ để lấy dữ liệu tổng hợp (chỉ khi cần Gemini)
      try {
        const axios = (await import('axios')).default;
        const { data: internalData } = await axios.get(
          'http://localhost:8080/api/v1/internal-data',
        );

        // Lấy các bảng dữ liệu
        const listings = internalData?.data?.listings || [];
        const bookings = internalData?.data?.bookings || [];
        const vouchers = internalData?.data?.vouchers || [];
        const services = internalData?.data?.services || [];
        const reviews = internalData?.data?.reviews || [];

        // Tổng số phòng
        const totalRooms = listings.length;

        // Tính số phòng đang trống (chỉ tính các phòng không có booking status = 'pending' hoặc 'paid' trong khoảng thời gian hiện tại)
        const now = new Date();
        const availableRooms = listings.filter((room: any) => {
          const roomBookings = bookings.filter(
            (b: any) =>
              b.listingId === room._id &&
              ['pending', 'paid'].includes(b.status),
          );
          // Nếu không có booking nào đang active thì phòng trống
          if (roomBookings.length === 0) return true;
          // Nếu tất cả booking đã check_out_date < hôm nay thì phòng trống
          return roomBookings.every((b: any) => {
            const checkOut = new Date(b.check_out_date || b.checkOutDate);
            return checkOut < now;
          });
        });
        const totalAvailableRooms = availableRooms.length;

        // Tổng số voucher đang hoạt động
        const totalActiveVouchers = vouchers.filter(
          (v: any) => v.is_active,
        ).length;

        // Tổng số dịch vụ
        const totalServices = services.length;

        // Tổng số review
        const totalReviews = reviews.length;

        // listingsText kèm điểm trung bình và số review từng phòng
        listingsText = listings
          .map((item: any, idx: number) => {
            const roomReviews = reviews.filter(
              (r: any) => r.room_id === item._id,
            );
            const avgRating =
              roomReviews.length > 0
                ? (
                    roomReviews.reduce(
                      (sum: number, r: any) => sum + (r.rating || 0),
                      0,
                    ) / roomReviews.length
                  ).toFixed(1)
                : 'Chưa có';
            return `Phòng ${idx + 1}:\n- Tên: ${item.title}\n- Giá mỗi đêm: ${item.price_per_night}\n- Mô tả: ${item.description}\n- Số review: ${roomReviews.length}\n- Điểm trung bình: ${avgRating}`;
          })
          .join('\n\n');

        // Kiểm tra xem có phòng nào trùng khớp với câu hỏi không
        matchedListing = listings.find((item: any) =>
          data.message
            .toLowerCase()
            .includes(item.title?.toLowerCase?.() || ''),
        );

        // Tạo context tổng hợp
        var contextSummary = `Tổng số phòng: ${totalRooms}\nSố phòng đang trống: ${totalAvailableRooms}\nTổng số voucher đang hoạt động: ${totalActiveVouchers}\nTổng số dịch vụ: ${totalServices}\nTổng số review: ${totalReviews}`;
        listingsText = `${contextSummary}\n\nDanh sách phòng:\n${listingsText}`;
      } catch (err) {
        listingsText = '';
      }

      // Nếu không có dữ liệu hoặc không khớp phòng
      if (!listingsText || !matchedListing) {
        const fallback = 'Không có dữ liệu.';
        client.emit('receive_message', { message: fallback });
        return;
      }

      // Tạo prompt chặt chẽ
      const guide =
        'Chỉ trả lời dựa trên danh sách phòng dưới đây. Không bịa thêm thông tin. Nếu không có thông tin phù hợp, trả lời: "Không có dữ liệu".';
      const prompt = PromptBuilder.buildPrompt(
        data.message,
        `${guide}\nDanh sách phòng:\n${listingsText}`,
      );

      // Gửi tới Gemini
      const reply = await this.chatbotService.askGemini(prompt);

      // Lưu tin nhắn vào MongoDB
      await this.chatbotMessageModel.create({
        content: data.message,
        user_id: data.userId,
        reply,
      });

      // Gửi lại cho client
      client.emit('receive_message', { message: reply });

      // Gửi tới cả room nếu cần
      this.server.to(`chatbot_user_${data.userId}`).emit('new_message', {
        content: data.message,
        reply,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Lỗi xử lý chatbot:', error);
      client.emit('receive_message', {
        message: 'Đã xảy ra lỗi khi xử lý yêu cầu.',
      });
    }
  }
}
