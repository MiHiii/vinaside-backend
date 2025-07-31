import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatbotMessage } from './schemas/chatbot-message.schema';
import { ChatbotService } from './chatbot.service';

// Interfaces for type safety
interface InternalData {
  data: {
    listings: Listing[];
    bookings: Booking[];
    vouchers: Voucher[];
    services: Service[];
    reviews: Review[];
  };
}

interface Listing {
  _id: string;
  title: string;
  price_per_night: number;
  description: string;
  images?: string[];
}

interface Booking {
  listingId: string;
  status: string;
  check_out_date?: string;
  checkOutDate?: string;
}

interface Voucher {
  is_active: boolean;
}

interface Service {
  // Add properties as needed
  name?: string;
}

interface Review {
  room_id: string;
  rating: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
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
    this.logger.log('ChatbotGateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove user from connected users
    for (const [key, value] of this.connectedUsers.entries()) {
      if (value.socketId === client.id) {
        this.connectedUsers.delete(key);
        break;
      }
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): { success: boolean; message: string } {
    try {
      this.connectedUsers.set(data.userId, {
        userId: data.userId,
        socketId: client.id,
      });
      client.join(`chatbot_${data.userId}`);
      return { success: true, message: 'Joined chatbot room successfully' };
    } catch (error) {
      this.logger.error('Error joining room:', error);
      return { success: false, message: 'Failed to join room' };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { userId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Lưu tin nhắn vào database
      await this.chatbotMessageModel.create({
        content: data.message,
        user_id: new Types.ObjectId(data.userId),
      });

      // Phân tích intent
      const intent = this.chatbotService.analyzeIntent(data.message);
      let listingsText = '';
      let matchedListing: Listing | undefined;

      // Nếu hỏi phòng giá rẻ nhất thì trả về luôn, không cần gọi Gemini
      if (intent === 'ask_cheapest_room') {
        try {
          const axios = (await import('axios')).default;
          const response = await axios.get<InternalData>(
            'http://localhost:8080/api/v1/internal-data',
          );
          const internalData = response.data;
          const listings = internalData?.data?.listings || [];
          if (listings.length === 0) {
            client.emit('receive_message', {
              message: 'Không có dữ liệu phòng.',
            });
            return;
          }
          // Tìm phòng giá rẻ nhất
          const cheapest = listings.reduce(
            (min: Listing, cur: Listing) =>
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
        const response = await axios.get<InternalData>(
          'http://localhost:8080/api/v1/internal-data',
        );
        const internalData = response.data;

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
        const availableRooms = listings.filter((room: Listing) => {
          const roomBookings = bookings.filter(
            (b: Booking) =>
              b.listingId === room._id &&
              ['pending', 'paid'].includes(b.status),
          );
          // Nếu không có booking nào đang active thì phòng trống
          if (roomBookings.length === 0) return true;
          // Nếu tất cả booking đã check_out_date < hôm nay thì phòng trống
          return roomBookings.every((b: Booking) => {
            const checkOut = new Date(b.check_out_date || b.checkOutDate || '');
            return checkOut < now;
          });
        });
        const totalAvailableRooms = availableRooms.length;

        // Tổng số voucher đang hoạt động
        const totalActiveVouchers = vouchers.filter(
          (v: Voucher) => v.is_active,
        ).length;

        // Tổng số dịch vụ
        const totalServices = services.length;

        // Tổng số review
        const totalReviews = reviews.length;

        // listingsText kèm điểm trung bình và số review từng phòng
        listingsText = listings
          .map((item: Listing, idx: number) => {
            const roomReviews = reviews.filter(
              (r: Review) => r.room_id === item._id,
            );
            const avgRating =
              roomReviews.length > 0
                ? (
                    roomReviews.reduce(
                      (sum: number, r: Review) => sum + (r.rating || 0),
                      0,
                    ) / roomReviews.length
                  ).toFixed(1)
                : 'Chưa có';
            return `Phòng ${idx + 1}:\n- Tên: ${item.title}\n- Giá mỗi đêm: ${item.price_per_night}\n- Mô tả: ${item.description}\n- Số review: ${roomReviews.length}\n- Điểm trung bình: ${avgRating}`;
          })
          .join('\n\n');

        // Kiểm tra xem có phòng nào trùng khớp với câu hỏi không
        matchedListing = listings.find((item: Listing) =>
          data.message
            .toLowerCase()
            .includes(item.title?.toLowerCase?.() || ''),
        );

        // Tạo context tổng hợp
        const contextSummary = `Tổng số phòng: ${totalRooms}\nSố phòng đang trống: ${totalAvailableRooms}\nTổng số voucher đang hoạt động: ${totalActiveVouchers}\nTổng số dịch vụ: ${totalServices}\nTổng số review: ${totalReviews}`;
        listingsText = `${contextSummary}\n\nDanh sách phòng:\n${listingsText}`;
      } catch {
        listingsText = '';
      }

      // Nếu không có dữ liệu hoặc không khớp phòng
      if (!listingsText || !matchedListing) {
        client.emit('receive_message', {
          message: 'Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này.',
        });
        return;
      }

      // Gọi Gemini API
      const response = await this.chatbotService.generateResponse(
        data.message,
        listingsText,
      );

      // Lưu phản hồi vào database
      await this.chatbotMessageModel.create({
        content: response,
        user_id: new Types.ObjectId(data.userId),
        reply: response,
      });

      client.emit('receive_message', { message: response });
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('receive_message', {
        message: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
      });
    }
  }
}
