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
import { STATIC_RESPONSES, detectIntent } from './intent-rules';
import axios from 'axios';

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
  status: string;
  voucher_ids?: string[];
  service_ids?: string[];
  view_type?: 'sea' | 'city' | 'garden';
  pet_friendly?: boolean;
  family_friendly?: boolean;
  cancellation_policy?: string;
  max_guests?: number;
  allow_infants?: boolean;
  max_infants?: number;
  allow_pets?: boolean;
  propertyId?: {
    _id: string;
    name: string;
    location?: {
      address?: string;
      city?: string;
      district?: string;
    };
    description?: string;
  };
}

interface Booking {
  _id: string;
  listingId: string;
  checkInDate: string;
  check_out_date: string;
  status: string;
}

interface Voucher {
  _id: string;
  code: string;
  discount_percent: number;
  expiration_date: string;
  is_active: boolean;
  min_order_value: number;
  min_nights?: number;
  event_name?: string;
}

interface Service {
  _id: string;
  name: string;
  default_price: number;
  description?: string;
}

interface Review {
  _id: string;
  room_id: string;
  rating: number;
  comment: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
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
    this.connectedUsers.forEach((value, key) => {
      if (value.socketId === client.id) this.connectedUsers.delete(key);
    });
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
  ): Promise<void> {
    try {
      await this.chatbotMessageModel.create({
        content: data.message,
        user_id: new Types.ObjectId(data.userId),
      });

      const intent = detectIntent(data.message);
      const internalData = await this.fetchInternalData();
      let response: string;

      if (STATIC_RESPONSES[intent] && intent !== 'ask_cheapest_room') {
        response = STATIC_RESPONSES[intent];
      } else {
        response = await this.handleDynamicIntent(
          intent,
          data.message,
          internalData,
        );
      }

      await this.chatbotMessageModel.create({
        content: response,
        user_id: new Types.ObjectId(data.userId),
        reply: response,
      });

      client.emit('receive_message', { message: response });
    } catch (error) {
      this.logger.error('Error handling message:', error);
      client.emit('receive_message', {
        message: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau nhé!',
      });
    }
  }

  private async fetchInternalData(): Promise<InternalData['data']> {
    try {
      const response = await axios.get<InternalData>(
        'http://localhost:8080/api/v1/internal-data',
      );
      return response.data.data;
    } catch {
      return {
        listings: [],
        bookings: [],
        vouchers: [],
        services: [],
        reviews: [],
      };
    }
  }

  private async handleCheapestRoom(): Promise<string> {
    const data = await this.fetchInternalData();
    const listings = data.listings.filter((room) => room.status === 'draft');
    if (!listings.length) return 'Không có dữ liệu phòng.';

    const cheapest = listings.reduce(
      (min, cur) => (cur.price_per_night < min.price_per_night ? cur : min),
      listings[0],
    );

    const voucher = data.vouchers.find(
      (v) => cheapest.voucher_ids?.includes(v._id) && v.is_active,
    );
    const discountInfo = voucher
      ? `Áp dụng voucher ${voucher.code} (giảm ${voucher.discount_percent}%, tối thiểu ${voucher.min_order_value}đ, hết hạn ${new Date(voucher.expiration_date).toLocaleDateString('vi-VN')})`
      : 'Hiện không có voucher áp dụng.';

    const imageUrl = cheapest.images?.[0] || 'Không có hình ảnh';
    return `🏡 Phòng giá rẻ nhất: **${cheapest.title}**\n💰 Giá: ${cheapest.price_per_night.toLocaleString('vi-VN')}đ/đêm\n📸 [Xem ảnh](${imageUrl})\n📝 Mô tả: ${cheapest.description}\n🎁 ${discountInfo}\n👉 [Xem chi tiết](${`/room-detail/${cheapest._id}`})\n🌟 Đặt ngay hôm nay để nhận ưu đãi độc quyền!`;
  }

  private async handleDynamicIntent(
    intent: string,
    message: string,
    data: InternalData['data'],
  ): Promise<string> {
    const { listings, bookings, vouchers, services, reviews } = data;
    const now = new Date('2025-08-01T12:05:00+07:00');

    const availableRooms: Listing[] = listings.filter((room) => {
      const roomBookings = bookings.filter(
        (b) =>
          b.listingId === room._id &&
          ['pending', 'confirmed', 'completed'].includes(b.status),
      );
      return (
        roomBookings.every((b) => {
          const checkOut = new Date(b.check_out_date);
          return checkOut < now;
        }) && room.status === 'draft'
      );
    });

    switch (intent) {
      case 'ask_price': {
        if (!availableRooms.length)
          return 'Không có phòng trống để kiểm tra giá.';
        const prices = availableRooms.map((room) => {
          const voucher = vouchers.find(
            (v) => room.voucher_ids?.includes(v._id) && v.is_active,
          );
          const priceInfo = voucher
            ? `Giá gốc: ${room.price_per_night.toLocaleString('vi-VN')}đ - Giảm ${voucher.discount_percent}% với voucher ${voucher.code} (hết hạn ${new Date(voucher.expiration_date).toLocaleDateString('vi-VN')})`
            : `Giá: ${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
          return `💸 ${room.title}: ${priceInfo}`;
        });
        return `📋 Giá các phòng trống:\n${prices.join('\n')}\n📌 Đặt ngay để tận hưởng kỳ nghỉ tại Đà Nẵng!`;
      }

      case 'check_availability': {
        if (!availableRooms.length)
          return 'Hiện không có phòng trống. Hãy theo dõi Fanpage để nhận thông báo khi có phòng mới nhé!';
        return `✅ Hiện có ${availableRooms.length} phòng trống: ${availableRooms
          .map((r) => r.title)
          .join(
            ', ',
          )}\n👉 Đặt ngay để không bỏ lỡ cơ hội nghỉ dưỡng giá tốt tại Vinaside!`;
      }

      case 'ask_rooms_by_location': {
        return this.handleRoomsByLocation(message, availableRooms, vouchers);
      }

      case 'ask_room_location': {
        return this.handleRoomLocation(message, availableRooms, vouchers);
      }

      case 'ask_specific_room': {
        return this.handleSpecificRoom(message, listings, vouchers, reviews);
      }

      case 'ask_property_info': {
        return this.handlePropertyInfo(message, availableRooms, vouchers);
      }

      case 'ask_room_amenities': {
        return this.handleRoomAmenities(message, availableRooms, services);
      }

      case 'ask_booking_process': {
        return `📋 Quy trình đặt phòng tại Vinaside:\n\n1️⃣ Chọn phòng phù hợp với nhu cầu\n2️⃣ Kiểm tra lịch trống và đặt ngày\n3️⃣ Điền thông tin cá nhân\n4️⃣ Chọn phương thức thanh toán (Momo, VNPay, tiền mặt)\n5️⃣ Xác nhận đặt phòng\n6️⃣ Nhận email xác nhận\n\n⏰ Check-in: 14:00 | Check-out: 12:00\n📞 Liên hệ: 0909.123.456 để được hỗ trợ!`;
      }

      case 'ask_booking_steps': {
        return `🚀 Các bước đặt phòng chi tiết:\n\n**Bước 1: Tìm kiếm** 🔍\n- Chọn địa điểm và ngày check-in/check-out\n- Lọc theo giá, tiện nghi, đánh giá\n\n**Bước 2: Chọn phòng** 🏠\n- Xem chi tiết phòng và hình ảnh\n- Kiểm tra chính sách hủy phòng\n\n**Bước 3: Đặt phòng** 📝\n- Điền thông tin cá nhân\n- Chọn phương thức thanh toán\n\n**Bước 4: Xác nhận** ✅\n- Nhận email xác nhận\n- Lưu mã đặt phòng\n\n**Bước 5: Check-in** 🎉\n- Đến đúng giờ nhận phòng\n- Xuất trình giấy tờ tùy thân\n\n📞 Cần hỗ trợ? Gọi ngay 0909.123.456!`;
      }

      case 'ask_vinaside_info': {
        return `🏖️ Vinaside - Nơi nghỉ dưỡng lý tưởng của bạn!\n\n**🎯 Chúng tôi cung cấp:**\n• Phòng nghỉ chất lượng cao với giá tốt nhất\n• Đa dạng loại phòng: Standard, Deluxe, Suite, Villa\n• Vị trí đắc địa gần biển, trung tâm thành phố\n• Tiện nghi hiện đại: WiFi, điều hòa, TV, bếp\n• Dịch vụ 24/7 và hỗ trợ tận tâm\n\n**📍 Địa điểm nổi bật:**\n• Đà Nẵng: Biển Mỹ Khê, Bán đảo Sơn Trà\n• Hội An: Phố cổ, Biển An Bàng\n• Ngũ Hành Sơn: Núi đá, Biển Non Nước\n\n**💎 Ưu đãi đặc biệt:**\n• Voucher giảm giá thường xuyên\n• Ưu đãi dài ngày\n• Gói combo du lịch\n\n**📞 Liên hệ:** 0909.123.456\n**🌐 Website:** www.vinaside.com\n\nHãy để Vinaside mang đến cho bạn kỳ nghỉ hoàn hảo! ✨`;
      }

      case 'ask_payment_methods': {
        return `💳 Các phương thức thanh toán:\n\n• 💰 Tiền mặt khi nhận phòng\n• 📱 Momo (QR Code)\n• 🏦 VNPay (Chuyển khoản)\n• 💳 Thẻ tín dụng/ghi nợ\n• 🏧 ATM (Chuyển khoản)\n\n✅ Tất cả đều an toàn và được bảo mật!\n📞 Liên hệ để được hướng dẫn chi tiết!`;
      }

      case 'ask_checkin_checkout': {
        return `⏰ Thời gian nhận và trả phòng:\n\n🕐 Check-in: 14:00 (2:00 PM)\n🕛 Check-out: 12:00 (12:00 PM)\n\n💡 Lưu ý:\n• Có thể check-in sớm nếu phòng trống\n• Có thể check-out muộn (tính phí)\n• Gửi hành lý miễn phí\n• Dịch vụ đưa đón sân bay (tính phí)\n\n📞 Liên hệ trước để sắp xếp!`;
      }

      case 'ask_room_capacity': {
        if (!availableRooms.length) return 'Không có phòng trống để kiểm tra.';
        const capacityInfo = availableRooms.map((room) => {
          const maxGuests = room.max_guests || 2;
          const guestInfo =
            maxGuests > 2 ? `${maxGuests} người lớn` : `${maxGuests} người`;
          return `🏠 ${room.title}: ${guestInfo}${room.allow_infants ? ` + ${room.max_infants || 0} trẻ em` : ''}`;
        });
        return `👥 Sức chứa các phòng trống:\n${capacityInfo.join('\n')}\n📞 Liên hệ để được tư vấn phòng phù hợp!`;
      }

      case 'ask_room_photos': {
        if (!availableRooms.length) return 'Không có phòng trống để xem ảnh.';
        const photoInfo = availableRooms.map((room) => {
          const imageCount = room.images?.length || 0;
          const mainImage = room.images?.[0] || 'Không có ảnh';
          return `📸 ${room.title}: ${imageCount} ảnh\n🔗 [Xem ảnh](${mainImage})`;
        });
        return `📸 Ảnh các phòng trống:\n${photoInfo.join('\n\n')}\n👉 Đặt phòng ngay để trải nghiệm thực tế!`;
      }

      case 'ask_room_availability_calendar': {
        return `📅 Lịch trống phòng:\n\nHiện tại chúng tôi đang cập nhật hệ thống lịch trống trực tuyến.\n\n📞 Vui lòng liên hệ 0909.123.456 để:\n• Kiểm tra lịch trống cụ thể\n• Đặt phòng theo ngày mong muốn\n• Nhận thông báo khi có phòng trống\n\n⏰ Phục vụ 24/7!`;
      }

      case 'ask_room_details': {
        const roomMatch = listings.find((item) =>
          message.toLowerCase().includes(item.title.toLowerCase()),
        );
        if (!roomMatch)
          return 'Vui lòng cung cấp tên phòng để xem chi tiết nhé!';
        const roomReviews = reviews.filter((r) => r.room_id === roomMatch._id);
        const avgRating = roomReviews.length
          ? (
              roomReviews.reduce((sum, r) => sum + r.rating, 0) /
              roomReviews.length
            ).toFixed(1)
          : 'Chưa có';
        const imageUrl = roomMatch.images?.[0] || 'Không có hình ảnh';
        return `🏠 **${roomMatch.title}**\n💰 Giá: ${roomMatch.price_per_night.toLocaleString('vi-VN')}đ/đêm\n📸 [Xem ảnh](${imageUrl})\n📝 Mô tả: ${roomMatch.description}\n⭐ Đánh giá: ${avgRating} sao (${roomReviews.length} đánh giá)\n👉 [Xem chi tiết](${`/room-detail/${roomMatch._id}`})`;
      }

      case 'ask_service': {
        if (!services.length) return 'Không có dữ liệu dịch vụ.';
        const uniqueServices = new Map<string, Service>();
        availableRooms.forEach((room) => {
          room.service_ids?.forEach((serviceId) => {
            const service = services.find((s) => s._id === serviceId);
            if (service) uniqueServices.set(service._id, service);
          });
        });
        return `🎉 Dịch vụ tại chỗ:\n${Array.from(uniqueServices.values())
          .map(
            (s) =>
              `- ${s.name}: ${s.default_price.toLocaleString('vi-VN')}đ${
                s.description ? ` (${s.description})` : ''
              }`,
          )
          .join(
            '\n',
          )}\n👉 Tận hưởng dịch vụ đẳng cấp và đặt phòng ngay hôm nay!`;
      }

      case 'ask_reviews': {
        const roomForReview = listings.find((item) =>
          message.toLowerCase().includes(item.title.toLowerCase()),
        );
        if (!roomForReview)
          return 'Vui lòng cung cấp tên phòng để xem đánh giá nhé!';
        const reviewsForRoom = reviews.filter(
          (r) => r.room_id === roomForReview._id,
        );
        if (!reviewsForRoom.length)
          return `Chưa có đánh giá cho ${roomForReview.title}. Hãy là người đầu tiên trải nghiệm và chia sẻ nhé!`;
        const topReview = reviewsForRoom.reduce((max, r) =>
          r.rating > max.rating ? r : max,
        );
        return `⭐ Đánh giá nổi bật cho ${roomForReview.title}:\n- ${topReview.rating} sao: "${topReview.comment}"\n📊 Điểm trung bình: ${(
          reviewsForRoom.reduce((sum, r) => sum + r.rating, 0) /
          reviewsForRoom.length
        ).toFixed(
          1,
        )} sao (${reviewsForRoom.length} đánh giá)\n👉 Đặt phòng ngay để tự mình khám phá!`;
      }

      case 'ask_family_room': {
        const familyRooms = availableRooms.filter((r) => r.family_friendly);
        if (!familyRooms.length)
          return 'Hiện không có phòng phù hợp cho gia đình. Hãy thử các phòng khác hoặc liên hệ để được tư vấn!';
        return `👨‍👩‍👧‍👦 Phòng phù hợp cho gia đình:\n${familyRooms
          .map(
            (r) =>
              `- **${r.title}**: Giá ${r.price_per_night.toLocaleString(
                'vi-VN',
              )}đ/đêm, ${r.description}`,
          )
          .join(
            '\n',
          )}\n📸 [Xem ảnh](https://example.com/family-room.jpg)\n👉 Đặt ngay để có kỳ nghỉ vui vẻ cùng gia đình!`;
      }

      case 'ask_view_room': {
        const seaViewRooms = availableRooms.filter(
          (r) => r.view_type === 'sea',
        );
        if (!seaViewRooms.length)
          return 'Hiện không có phòng view biển. Hãy thử các phòng khác hoặc theo dõi Fanpage để cập nhật!';
        return `🌊 Phòng view biển đẹp nhất:\n${seaViewRooms
          .map(
            (r) =>
              `- **${r.title}**: Giá ${r.price_per_night.toLocaleString(
                'vi-VN',
              )}đ/đêm, ${r.description}\n📸 [Xem ảnh](${
                r.images?.[0] || 'Không có hình ảnh'
              })`,
          )
          .join('\n')}\n👉 Đặt ngay để ngắm biển Đà Nẵng mỗi ngày!`;
      }

      case 'ask_pet_policy': {
        const petFriendlyRooms = availableRooms.filter((r) => r.allow_pets);
        if (!petFriendlyRooms.length)
          return 'Hiện không có phòng cho phép mang thú cưng. Hãy liên hệ để được tư vấn thêm!';
        return `🐶 Phòng cho phép mang thú cưng:\n${petFriendlyRooms
          .map(
            (r) =>
              `- **${r.title}**: Giá ${r.price_per_night.toLocaleString(
                'vi-VN',
              )}đ/đêm, Phí phụ thu 200,000đ/đêm/thú cưng.`,
          )
          .join(
            '\n',
          )}\n📌 Vui lòng báo trước để chúng tôi chuẩn bị tốt nhất!\n👉 Đặt ngay!`;
      }

      case 'ask_long_stay_discount': {
        const longStayVouchers = vouchers.filter(
          (v) => v.min_nights && v.is_active,
        );
        if (!longStayVouchers.length)
          return 'Hiện không có ưu đãi cho đặt phòng dài ngày. Hãy theo dõi Fanpage để cập nhật!';
        return `🏖️ Ưu đãi đặt phòng dài ngày:\n${longStayVouchers
          .map(
            (v) =>
              `- **${v.code}**: Giảm ${v.discount_percent}% cho đặt từ ${
                v.min_nights
              } đêm, tối thiểu ${v.min_order_value.toLocaleString(
                'vi-VN',
              )}đ (hết hạn ${new Date(v.expiration_date).toLocaleDateString(
                'vi-VN',
              )})`,
          )
          .join('\n')}\n👉 Đặt ngay để tiết kiệm hơn!`;
      }

      case 'ask_event_discount': {
        const eventVouchers = vouchers.filter(
          (v) => v.event_name && v.is_active,
        );
        if (!eventVouchers.length)
          return 'Hiện không có ưu đãi cho dịp lễ. Hãy theo dõi Fanpage để cập nhật!';
        return `🎆 Ưu đãi dịp lễ:\n${eventVouchers
          .map(
            (v) =>
              `- **${v.event_name}**: Giảm ${v.discount_percent}% với mã ${
                v.code
              }, áp dụng đến ${new Date(v.expiration_date).toLocaleDateString(
                'vi-VN',
              )}`,
          )
          .join('\n')}\n👉 Đặt ngay để tận hưởng kỳ nghỉ lễ tuyệt vời!`;
      }

      case 'ask_cancellation_policy': {
        const roomForPolicy = listings.find((item) =>
          message.toLowerCase().includes(item.title.toLowerCase()),
        );
        if (!roomForPolicy)
          return `❓ Chính sách hủy phòng chung:  
          - Hủy trước 7 ngày: Hoàn tiền 100%.  
          - Hủy trước 3 ngày: Hoàn 50%.  
          - Sau 3 ngày: Không hoàn tiền, nhưng có thể đổi ngày lưu trú miễn phí.  
          📌 Vui lòng cung cấp tên phòng để xem chính sách cụ thể!`;
        return `❓ Chính sách hủy cho **${roomForPolicy.title}**: ${
          roomForPolicy.cancellation_policy ||
          'Hủy trước 7 ngày: Hoàn 100%; trước 3 ngày: Hoàn 50%; sau 3 ngày: Không hoàn tiền.'
        }\n📌 Liên hệ để được hỗ trợ chi tiết!`;
      }

      default: {
        const roomByName = this.findRoomByName(message, listings);
        if (roomByName) {
          return this.generateRoomInfo(roomByName, vouchers, reviews);
        }

        const locationInfo = this.extractLocationInfo(message, availableRooms);
        if (locationInfo) {
          return locationInfo;
        }

        const prompt = this.chatbotService.buildPrompt(
          message,
          JSON.stringify({ listings, bookings, vouchers, services, reviews }),
        );
        return this.chatbotService.generateResponse(prompt);
      }
    }
  }

  private handleRoomsByLocation(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    const msg = message.toLowerCase();

    const locationKeywords = [
      'đà nẵng',
      'hội an',
      'sơn trà',
      'quảng ninh',
      'liên chiểu',
      'tam đảo',
      'cẩm lệ',
      'thanh khê',
      'hoà vang',
      'biển',
      'beach',
      'trung tâm',
      'center',
      'hồ chí minh',
      'airport',
      'ninh bình',
      'market',
      'bãi biển',
      'mỹ khê',
      'hà nội',
      'bán đảo',
      'peninsula',
    ];

    const matchedLocation = locationKeywords.find((keyword) =>
      msg.includes(keyword),
    );

    if (!matchedLocation) {
      return 'Vui lòng cho biết cụ thể địa điểm bạn muốn tìm phòng (ví dụ: Đà Nẵng, Hội An, Sơn Trà, v.v.)';
    }

    const roomsInLocation = availableRooms.filter((room) => {
      if (!room.propertyId || typeof room.propertyId === 'string') {
        return false;
      }

      const property = room.propertyId;
      const propertyAddress = property.location?.address?.toLowerCase() || '';
      const propertyCity = property.location?.city?.toLowerCase() || '';
      const propertyDistrict = property.location?.district?.toLowerCase() || '';

      return (
        propertyAddress.includes(matchedLocation) ||
        propertyCity.includes(matchedLocation) ||
        propertyDistrict.includes(matchedLocation)
      );
    });

    if (roomsInLocation.length === 0) {
      return `Hiện không có phòng trống tại ${matchedLocation}. Hãy thử tìm phòng ở các khu vực khác hoặc liên hệ để được tư vấn!`;
    }

    const roomList = roomsInLocation
      .map((room) => {
        const property = room.propertyId;
        const voucher = vouchers.find(
          (v) => room.voucher_ids?.includes(v._id) && v.is_active,
        );

        let priceInfo = `${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
        if (voucher) {
          priceInfo += ` (Giảm ${voucher.discount_percent}% với voucher ${voucher.code})`;
        }

        return `🏠 **${room.title}**\n📍 ${property?.location?.address || 'Địa chỉ đang cập nhật'}\n💰 ${priceInfo}\n📝 ${room.description || 'Mô tả đang cập nhật'}`;
      })
      .join('\n\n');

    return `🏖️ Phòng trống tại ${matchedLocation}:\n\n${roomList}\n\n📞 Liên hệ 0909.123.456 để đặt phòng ngay!`;
  }

  private handlePropertyInfo(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    const msg = message.toLowerCase();

    const propertyTypes = [
      'khách sạn',
      'hotel',
      'resort',
      'villa',
      'apartment',
      'chỗ nghỉ',
      'nơi ở',
    ];
    const matchedType = propertyTypes.find((type) => msg.includes(type));

    if (!matchedType) {
      return 'Vui lòng cho biết loại chỗ nghỉ bạn quan tâm (khách sạn, resort, villa, apartment)';
    }

    const properties = new Map<
      string,
      { property: Listing['propertyId']; rooms: Listing[] }
    >();
    availableRooms.forEach((room) => {
      if (room.propertyId && typeof room.propertyId === 'object') {
        const property = room.propertyId;
        if (!properties.has(property._id)) {
          properties.set(property._id, {
            property,
            rooms: [],
          });
        }
        const propertyData = properties.get(property._id);
        if (propertyData) {
          propertyData.rooms.push(room);
        }
      }
    });

    if (properties.size === 0) {
      return `Hiện không có ${matchedType} trống. Hãy thử tìm loại chỗ nghỉ khác hoặc liên hệ để được tư vấn!`;
    }

    const propertyList = Array.from(properties.values())
      .map(({ property, rooms }) => {
        if (!property) return '';

        const avgPrice =
          rooms.reduce((sum, room) => sum + room.price_per_night, 0) /
          rooms.length;
        const voucher = vouchers.find(
          (v) =>
            rooms.some((room) => room.voucher_ids?.includes(v._id)) &&
            v.is_active,
        );

        let priceInfo = `Từ ${Math.floor(avgPrice).toLocaleString('vi-VN')}đ/đêm`;
        if (voucher) {
          priceInfo += ` (Có voucher giảm ${voucher.discount_percent}%)`;
        }

        return `🏨 **${property.name}**\n📍 ${property.location?.address || 'Địa chỉ đang cập nhật'}\n💰 ${priceInfo}\n🏠 ${rooms.length} phòng trống\n📝 ${property.description || 'Mô tả đang cập nhật'}`;
      })
      .filter(Boolean)
      .join('\n\n');

    return `🏖️ ${matchedType.charAt(0).toUpperCase() + matchedType.slice(1)} có sẵn:\n\n${propertyList}\n\n📞 Liên hệ 0909.123.456 để đặt phòng ngay!`;
  }

  private handleRoomAmenities(
    message: string,
    availableRooms: Listing[],
    services: Service[],
  ): string {
    const msg = message.toLowerCase();

    const amenityKeywords = [
      'wifi',
      'tủ lạnh',
      'điều hòa',
      'ac',
      'tv',
      'tivi',
      'bếp',
      'kitchen',
      'máy giặt',
      'washing',
      'parking',
      'bãi xe',
      'swimming',
      'hồ bơi',
      'gym',
      'phòng tập',
      'tiện nghi',
      'amenity',
    ];

    const matchedAmenity = amenityKeywords.find((keyword) =>
      msg.includes(keyword),
    );

    if (!matchedAmenity) {
      return 'Vui lòng cho biết tiện nghi cụ thể bạn quan tâm (WiFi, điều hòa, bếp, hồ bơi, v.v.)';
    }

    const roomsWithAmenity = availableRooms.filter((room) => {
      if (room.service_ids && room.service_ids.length > 0) {
        const roomServices = services.filter((service) =>
          room.service_ids!.includes(service._id),
        );
        return roomServices.some(
          (service) =>
            service.name.toLowerCase().includes(matchedAmenity) ||
            (service.description &&
              service.description.toLowerCase().includes(matchedAmenity)),
        );
      }
      return false;
    });

    if (roomsWithAmenity.length === 0) {
      return `Hiện không có phòng có tiện nghi ${matchedAmenity}. Hãy thử tìm tiện nghi khác hoặc liên hệ để được tư vấn!`;
    }

    const roomList = roomsWithAmenity
      .map((room) => {
        const roomServices = services.filter((service) =>
          room.service_ids?.includes(service._id),
        );
        const amenityList = roomServices
          .map(
            (service) =>
              `${service.name}${service.description ? ` (${service.description})` : ''}`,
          )
          .join(', ');

        return `🏠 **${room.title}**\n💰 ${room.price_per_night.toLocaleString('vi-VN')}đ/đêm\n🔧 Tiện nghi: ${amenityList || 'Đang cập nhật'}`;
      })
      .join('\n\n');

    return `🔧 Phòng có tiện nghi ${matchedAmenity}:\n\n${roomList}\n\n📞 Liên hệ 0909.123.456 để đặt phòng ngay!`;
  }

  private handleSpecificRoom(
    message: string,
    listings: Listing[],
    vouchers: Voucher[],
    reviews: Review[],
  ): string {
    const room = this.findRoomByName(message, listings);
    if (!room) {
      return 'Không tìm thấy phòng bạn yêu cầu. Vui lòng kiểm tra lại tên phòng hoặc liên hệ để được tư vấn!';
    }

    return this.generateRoomInfo(room, vouchers, reviews);
  }

  private handleRoomLocation(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    const msg = message.toLowerCase();

    const roomNameMatch = msg.match(/(phòng|room)\s+([^ở\s]+(?:\s+[^ở\s]+)*)/i);
    if (!roomNameMatch) {
      return 'Vui lòng cho biết tên phòng cụ thể bạn muốn tìm (ví dụ: "Phòng Hoa Mộc Lan ở chỗ nào")';
    }

    const roomName = roomNameMatch[2].trim();

    const targetRoom = availableRooms.find(
      (room) =>
        room.title.toLowerCase().includes(roomName.toLowerCase()) ||
        roomName.toLowerCase().includes(room.title.toLowerCase()),
    );

    if (!targetRoom) {
      return `Không tìm thấy phòng "${roomName}" trong danh sách phòng trống. Vui lòng kiểm tra lại tên phòng hoặc liên hệ để được tư vấn!`;
    }

    const property = targetRoom.propertyId;
    if (!property || typeof property === 'string') {
      return `Phòng ${targetRoom.title} hiện không có thông tin địa chỉ. Vui lòng liên hệ để được tư vấn chi tiết!`;
    }

    const voucher = vouchers.find(
      (v) => targetRoom.voucher_ids?.includes(v._id) && v.is_active,
    );

    let priceInfo = `${targetRoom.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
    if (voucher) {
      priceInfo += ` (Giảm ${voucher.discount_percent}% với voucher ${voucher.code})`;
    }

    return `🏠 **${targetRoom.title}**\n\n📍 **Địa chỉ:** ${property.location?.address || 'Đang cập nhật'}\n🏨 **Property:** ${property.name}\n💰 **Giá:** ${priceInfo}\n📝 **Mô tả:** ${targetRoom.description || 'Đang cập nhật'}\n\n📞 **Liên hệ:** 0909.123.456 để đặt phòng ngay!`;
  }

  private findRoomByName(message: string, listings: Listing[]): Listing | null {
    const msg = message.toLowerCase();

    const roomPatterns = [
      /phòng\s+([^ở\s]+(?:\s+[^ở\s]+)*)/i,
      /room\s+([^ở\s]+(?:\s+[^ở\s]+)*)/i,
      /([^ở\s]+(?:\s+[^ở\s]+)*)\s+ở/i,
      /([^ở\s]+(?:\s+[^ở\s]+)*)\s+location/i,
      /([^ở\s]+(?:\s+[^ở\s]+)*)\s+address/i,
    ];

    for (const pattern of roomPatterns) {
      const match = msg.match(pattern);
      if (match) {
        const roomName = match[1].trim();
        const foundRoom = listings.find(
          (room) =>
            room.title.toLowerCase().includes(roomName.toLowerCase()) ||
            roomName.toLowerCase().includes(room.title.toLowerCase()),
        );
        if (foundRoom) return foundRoom;
      }
    }

    for (const room of listings) {
      if (msg.includes(room.title.toLowerCase())) {
        return room;
      }
    }

    return null;
  }

  private generateRoomInfo(
    room: Listing,
    vouchers: Voucher[],
    reviews: Review[],
  ): string {
    const voucher = vouchers.find(
      (v) => room.voucher_ids?.includes(v._id) && v.is_active,
    );

    const roomReviews = reviews.filter((r) => r.room_id === room._id);
    const avgRating = roomReviews.length
      ? (
          roomReviews.reduce((sum, r) => sum + r.rating, 0) / roomReviews.length
        ).toFixed(1)
      : 'Chưa có';

    let priceInfo = `${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
    if (voucher) {
      priceInfo += ` (Giảm ${voucher.discount_percent}% với voucher ${voucher.code})`;
    }

    const property = room.propertyId;
    const address =
      property && typeof property === 'object'
        ? property.location?.address || 'Đang cập nhật'
        : 'Đang cập nhật';

    return `🏠 **${room.title}**\n\n📍 **Địa chỉ:** ${address}\n💰 **Giá:** ${priceInfo}\n📝 **Mô tả:** ${room.description || 'Đang cập nhật'}\n⭐ **Đánh giá:** ${avgRating} sao (${roomReviews.length} đánh giá)\n\n📞 **Liên hệ:** 0909.123.456 để đặt phòng ngay!`;
  }

  private extractLocationInfo(
    message: string,
    availableRooms: Listing[],
  ): string | null {
    const msg = message.toLowerCase();

    const locationKeywords = [
      'đà nẵng',
      'hội an',
      'sơn trà',
      'ngũ hành sơn',
      'liên chiểu',
      'hải châu',
      'cẩm lệ',
      'thanh khê',
      'hoà vang',
      'biển',
      'beach',
      'trung tâm',
      'center',
      'sân bay',
      'airport',
      'chợ',
      'market',
      'bãi biển',
      'mỹ khê',
      'non nước',
      'bán đảo',
      'peninsula',
    ];

    const matchedLocation = locationKeywords.find((keyword) =>
      msg.includes(keyword),
    );
    if (!matchedLocation) return null;

    const roomsInLocation = availableRooms.filter((room) => {
      if (!room.propertyId || typeof room.propertyId === 'string') return false;

      const property = room.propertyId;
      const propertyAddress = property.location?.address?.toLowerCase() || '';
      const propertyCity = property.location?.city?.toLowerCase() || '';
      const propertyDistrict = property.location?.district?.toLowerCase() || '';

      return (
        propertyAddress.includes(matchedLocation) ||
        propertyCity.includes(matchedLocation) ||
        propertyDistrict.includes(matchedLocation)
      );
    });

    if (roomsInLocation.length === 0) {
      return `Hiện không có phòng trống tại ${matchedLocation}. Hãy thử tìm phòng ở các khu vực khác hoặc liên hệ để được tư vấn!`;
    }

    const roomList = roomsInLocation
      .map((room) => {
        const property = room.propertyId;
        return `🏠 **${room.title}**\n📍 ${property?.location?.address || 'Địa chỉ đang cập nhật'}\n💰 ${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
      })
      .join('\n\n');

    return `🏖️ Phòng trống tại ${matchedLocation}:\n\n${roomList}\n\n📞 Liên hệ 0909.123.456 để đặt phòng ngay!`;
  }
}
