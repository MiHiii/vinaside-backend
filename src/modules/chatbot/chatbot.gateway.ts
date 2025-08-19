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
  async handleJoinRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.connectedUsers.set(data.userId, {
        userId: data.userId,
        socketId: client.id,
      });
      await client.join(`chatbot_${data.userId}`);
      return { success: true, message: 'Joined chatbot room successfully' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Error joining room:', errorMessage);
      return { success: false, message: 'Failed to join room' };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { userId: string; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      // Validate input
      if (!data.userId || !data.message || data.message.trim().length === 0) {
        client.emit('receive_message', {
          message: 'Vui lòng nhập câu hỏi của bạn!',
        });
        return;
      }

      // Log thông tin tin nhắn nhận được
      this.logger.log(
        `Nhận tin nhắn từ user ${data.userId}: "${data.message}"`,
      );

      // Lưu câu hỏi người dùng
      await this.chatbotMessageModel.create({
        content: data.message,
        user_id: new Types.ObjectId(data.userId),
      });

      // Kiểm tra tin nhắn có quá dài không
      if (data.message.length > 500) {
        data.message = data.message.substring(0, 500);
        this.logger.warn(`Tin nhắn quá dài, đã cắt ngắn: ${data.message}`);
      }

      // Thông báo đang xử lý để UX tốt hơn
      client.emit('receive_typing', { isTyping: true });

      // Phân tích intent và lấy dữ liệu
      const intent = detectIntent(data.message);
      this.logger.log(`Intent được nhận diện: ${intent}`);

      // Lấy dữ liệu từ API
      let internalData;
      try {
        internalData = await this.fetchInternalData();
        this.logger.log(
          `Đã lấy dữ liệu thành công: ${(internalData as { listings: any[] }).listings.length} phòng`,
        );
      } catch (dataError) {
        this.logger.error('Lỗi khi lấy dữ liệu:', dataError);
        internalData = {
          listings: [],
          bookings: [],
          vouchers: [],
          services: [],
          reviews: [],
        };
      }

      let response: string;
      try {
        // Xử lý các câu trả lời tĩnh
        if (STATIC_RESPONSES[intent] && intent !== 'ask_cheapest_room') {
          this.logger.log(`Sử dụng câu trả lời tĩnh cho intent: ${intent}`);
          response = STATIC_RESPONSES[intent] as string;
        } else {
          // Xử lý các câu trả lời động
          this.logger.log(`Xử lý intent động: ${intent}`);
          response = await this.handleDynamicIntent(
            intent,
            data.message,
            internalData as {
              listings: Listing[];
              bookings: Booking[];
              vouchers: Voucher[];
              services: Service[];
              reviews: Review[];
            },
          );
        }
      } catch (intentError) {
        this.logger.error('Lỗi khi xử lý intent:', intentError);
        response =
          'Xin lỗi, tôi không hiểu câu hỏi của bạn. Bạn có thể hỏi về giá phòng, tiện nghi, dịch vụ, hoặc liên hệ 0909.123.456 để được hỗ trợ!';
      }

      // Lưu câu trả lời
      await this.chatbotMessageModel.create({
        content: response,
        user_id: new Types.ObjectId(data.userId),
        reply: response,
      });

      // Gửi câu trả lời cho client
      client.emit('receive_message', { message: response });
      client.emit('receive_typing', { isTyping: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error('Error handling message:', errorMessage);

      client.emit('receive_typing', { isTyping: false });
      client.emit('receive_message', {
        message:
          'Xin lỗi, có lỗi xảy ra. Hệ thống đang bận, vui lòng thử lại sau hoặc liên hệ 0909.123.456 để được hỗ trợ trực tiếp!',
      });
    }
  }

  private async fetchInternalData(): Promise<InternalData['data']> {
    try {
      // Thêm timeout để tránh chờ quá lâu
      const response = await axios.get<InternalData>(
        'http://localhost:8080/api/v1/internal-data',
        { timeout: 5000 }, // Timeout sau 5 giây
      );

      if (!response?.data?.data) {
        this.logger.warn('Internal data API trả về dữ liệu không hợp lệ');
        throw new Error('Invalid data structure');
      }

      // Log số lượng dữ liệu nhận được
      const data = response.data.data;
      this.logger.log(
        `Fetched data: ${data.listings.length} listings, ${data.vouchers.length} vouchers, ${data.services.length} services, ${data.reviews.length} reviews`,
      );

      return data;
    } catch (error) {
      const err = error as {
        response?: { status: string; data: any };
        request?: any;
        message?: string;
      };

      if (err.response) {
        this.logger.error(
          `Internal data API error (${err.response.status}):`,
          err.response.data,
        );
      } else if (err.request) {
        this.logger.error('Internal data API no response:', err.message);
      } else {
        this.logger.error('Internal data API error:', err.message);
      }

      // Trả về object rỗng trong trường hợp lỗi
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

    // Log để debug
    this.logger.log(`Xử lý intent: ${intent} với tin nhắn: "${message}"`);

    // Kiểm tra có dữ liệu phòng không
    if (!listings || listings.length === 0) {
      this.logger.warn('Không có dữ liệu phòng');
      return 'Hiện tại hệ thống chưa có dữ liệu về phòng. Vui lòng thử lại sau hoặc liên hệ 0909.123.456 để được hỗ trợ!';
    }

    const availableRooms: Listing[] = listings.filter((room) => {
      const activeBookings = bookings.filter(
        (b) =>
          b.listingId === room._id &&
          ['confirmed', 'completed'].includes(b.status),
      );
      const hasOverlap = activeBookings.some(
        (b) => new Date(b.check_out_date) > now,
      );
      return !hasOverlap && room.status === 'draft';
    });

    // Log số lượng phòng có sẵn
    this.logger.log(
      `Số phòng có sẵn: ${availableRooms.length}/${listings.length}`,
    );

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
      case 'check_availability_weekend': {
        const nextSaturday = new Date(now);
        const day = nextSaturday.getDay();
        const diffToSat = (6 - day + 7) % 7;
        nextSaturday.setDate(nextSaturday.getDate() + diffToSat);
        nextSaturday.setHours(0, 0, 0, 0);
        const nextMonday = new Date(nextSaturday);
        nextMonday.setDate(nextMonday.getDate() + 2);
        const weekendAvailable = listings.filter((room) => {
          const activeBookings = bookings.filter(
            (b) =>
              b.listingId === room._id &&
              ['confirmed', 'completed'].includes(b.status),
          );
          const overlap = activeBookings.some((b) => {
            const inDate = new Date(b.checkInDate);
            const outDate = new Date(b.check_out_date);
            return inDate < nextMonday && outDate > nextSaturday;
          });
          return !overlap && room.status === 'draft';
        });
        if (!weekendAvailable.length)
          return 'Cuối tuần này chưa có phòng trống phù hợp. Bạn muốn xem tuần kế tiếp không?';
        return `✅ Cuối tuần có ${weekendAvailable.length} phòng trống: ${weekendAvailable
          .map((r) => r.title)
          .join(', ')}\n👉 Bạn muốn mình giữ chỗ không?`;
      }

      case 'ask_room_count': {
        // Xác định địa điểm được đề cập (nếu có)
        const locationMatch = this.extractLocationFromQuery(message);

        if (locationMatch) {
          // Tìm phòng theo địa điểm
          const roomsInLocation = this.findRoomsByLocation(
            availableRooms,
            locationMatch,
          );
          const totalRooms = this.findRoomsByLocation(listings, locationMatch);

          if (totalRooms.length === 0) {
            return `Hiện tại chưa có phòng nào tại ${locationMatch}. Bạn có thể tìm phòng ở khu vực khác như Đà Nẵng, Hội An hoặc Nha Trang.`;
          }

          return `🏨 Tại ${locationMatch}, chúng tôi có ${totalRooms.length} phòng, trong đó ${roomsInLocation.length} phòng đang trống và sẵn sàng đặt.
📊 Các loại phòng: ${[...new Set(totalRooms.map((r) => r.title.split(' ')[0]))].join(', ')}
💰 Giá từ ${Math.min(...totalRooms.map((r) => r.price_per_night)).toLocaleString('vi-VN')}đ - ${Math.max(...totalRooms.map((r) => r.price_per_night)).toLocaleString('vi-VN')}đ/đêm
👉 Bạn muốn biết thêm chi tiết về loại phòng nào không?`;
        } else {
          // Trả về tổng số phòng
          return `🏨 Vinaside hiện có tổng cộng ${listings.length} phòng, trong đó ${availableRooms.length} phòng đang trống.
📊 Các địa điểm: Đà Nẵng, Hội An, Nha Trang, Hà Nội
👉 Bạn muốn biết thông tin phòng ở địa điểm nào?`;
        }
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

      case 'ask_all_rooms': {
        if (!listings.length) return 'Hiện chưa có dữ liệu phòng.';
        const list = listings
          .slice(0, 50)
          .map(
            (r) =>
              `- ${r.title} (${r.price_per_night.toLocaleString('vi-VN')}đ/đêm)`,
          )
          .join('\n');
        return `📋 Danh sách phòng hiện có:\n${list}\n👉 Bạn muốn xem chi tiết phòng nào?`;
      }

      // NEW: Handle comparison questions
      case 'ask_comparison': {
        return this.handleComparisonQuestions(
          message,
          availableRooms,
          vouchers,
        );
      }

      // NEW: Handle attraction and activity questions
      case 'ask_nearby_attractions': {
        return this.handleAttractionQuestions(message, availableRooms);
      }

      case 'ask_beach_activities': {
        return `🏖️ **Hoạt động biển tại Đà Nẵng:**\n\n🏊‍♀️ **Bơi lội & Tắm biển:**\n• Biển Mỹ Khê - bãi biển đẹp nhất VN\n• Biển Non Nước - yên tĩnh, sạch sẽ\n• Biển Bãi Bắc - ít người, hoang sơ\n\n🤿 **Lặn ngắm san hô:**\n• Tour lặn Hòn Chảo\n• Lặn tại Bán đảo Sơn Trà\n• Câu cá và lặn tại Cù Lao Chàm\n\n🚤 **Thể thao nước:**\n• Lướt ván - Surf\n• Chèo thuyền Kayak\n• Parasailing ngắm toàn cảnh\n• Jet ski\n\n📞 Liên hệ để được tư vấn tour và thuê phòng gần biển!`;
      }

      case 'ask_adventure': {
        return `⛰️ **Phiêu lưu mạo hiểm tại Đà Nẵng:**\n\n🏔️ **Leo núi & Trekking:**\n• Ngũ Hành Sơn - khám phá hang động\n• Núi Thần Tài - zipline dài nhất VN\n• Bán đảo Sơn Trà - trekking ngắm voọc\n\n🏍️ **Phượt motor:**\n• Đèo Hải Vân - cung đường ven biển\n• Hành trình Đà Nẵng - Hội An\n• Tour motor khám phá làng cổ\n\n🎯 **Extreme Sports:**\n• Bungee jumping tại Ba Na Hills\n• Canyoning tại thác Yang Bay\n• Rock climbing tại Marble Mountains\n\n🏨 Đặt phòng tại các khu vực gần địa điểm phiêu lưu để tiết kiệm thời gian di chuyển!`;
      }

      case 'ask_wellness': {
        return `🧘‍♀️ **Thư giãn & Chăm sóc sức khỏe:**\n\n💆‍♀️ **Spa & Massage:**\n• Thăng Long Spa - 5 sao quốc tế\n• Minh An Spa - massage truyền thống\n• La Siesta Spa - view biển tuyệt đẹp\n\n🧘 **Yoga & Meditation:**\n• Yoga sunrise tại bãi biển Mỹ Khê\n• Meditation retreat tại chùa Linh Ứng\n• Hot yoga tại các resort cao cấp\n\n🌿 **Natural Healing:**\n• Tắm bùn khoáng I-Resort\n• Suối nước nóng Núi Thần Tài\n• Aromatherapy tại các resort\n\n🏨 Nhiều phòng của chúng tôi gần các spa nổi tiếng, thuận tiện cho việc thư giãn!`;
      }

      // NEW: Handle transportation questions
      case 'ask_transportation': {
        return this.handleTransportationQuestions(message, availableRooms);
      }

      // NEW: Handle food and restaurant questions
      case 'ask_food_restaurant': {
        return this.handleFoodQuestions(message, availableRooms);
      }

      // NEW: Handle weather questions
      case 'ask_weather_season': {
        return `🌤️ **Thời tiết Đà Nẵng qua các mùa:**\n\n🌞 **Mùa khô (Feb-Aug):**\n• Nắng đẹp, ít mưa\n• Nhiệt độ 25-35°C\n• Thích hợp tắm biển\n• **Thời điểm tốt nhất:** Mar-May\n\n🌧️ **Mùa mưa (Sep-Jan):**\n• Mưa nhiều, bão thỉnh thoảng\n• Nhiệt độ 20-28°C\n• Ít khách, giá phòng rẻ\n• Thích hợp nghỉ dưỡng\n\n🏖️ **Lời khuyên:**\n• **Tắm biển:** Feb-Aug\n• **Tiết kiệm:** Sep-Dec\n• **Lễ hội:** Tết Nguyên Đán\n\n📞 Liên hệ để được tư vấn phòng theo mùa phù hợp!`;
      }

      // NEW: Handle business travel questions
      case 'ask_business_group': {
        return this.handleBusinessQuestions(message, availableRooms, services);
      }

      // NEW: Handle romantic travel questions
      case 'ask_romantic_couple': {
        return this.handleRomanticQuestions(message, availableRooms, vouchers);
      }

      // NEW: Handle all other dynamic questions with AI
      case 'dynamic_question': {
        return this.handleAIQuestion(message, {
          listings,
          bookings,
          vouchers,
          services,
          reviews,
        });
      }

      default: {
        // Log để debug
        this.logger.log(`Xử lý default case cho tin nhắn: "${message}"`);

        // Trước tiên kiểm tra địa điểm
        const locationMatch = this.extractLocationFromQuery(message);
        if (locationMatch) {
          this.logger.log(
            `Tìm thấy địa điểm trong default case: ${locationMatch}`,
          );
          return this.handleRoomsByLocation(message, availableRooms, vouchers);
        }

        // Trước tiên kiểm tra xem có phải câu hỏi về phòng cụ thể không
        const roomByName = this.findRoomByName(message, listings);
        if (roomByName) {
          this.logger.log(
            `Tìm thấy phòng trong default case: ${roomByName.title}`,
          );
          return this.generateRoomInfo(roomByName, vouchers, reviews);
        }

        // Kiểm tra xem có phải câu hỏi về vị trí không
        const locationInfo = this.extractLocationInfo(message, availableRooms);
        if (locationInfo) {
          return locationInfo;
        }

        // Kiểm tra câu hỏi về phòng có các tiện nghi
        if (
          message.toLowerCase().includes('wifi') ||
          message.toLowerCase().includes('tiện nghi') ||
          message.toLowerCase().includes('amenity')
        ) {
          return this.handleRoomAmenities(message, availableRooms, services);
        }

        // Kiểm tra câu hỏi về sức chứa phòng
        if (
          message.toLowerCase().includes('bao nhiêu người') ||
          message.toLowerCase().includes('capacity') ||
          message.toLowerCase().includes('sức chứa')
        ) {
          return `Các phòng của chúng tôi có sức chứa từ 2-6 người tùy loại phòng:\n- Phòng Standard: 2 người\n- Phòng Deluxe: 2-3 người\n- Phòng Family: 3-4 người\n- Phòng Suite: 4-6 người\n\nMỗi phòng có thể thêm 1 giường phụ với phụ phí 200.000đ/đêm. Trẻ em dưới 6 tuổi ở miễn phí khi dùng chung giường với bố mẹ.`;
        }

        // Kiểm tra câu hỏi về quy trình đặt phòng
        if (
          message.toLowerCase().includes('đặt phòng') ||
          message.toLowerCase().includes('booking')
        ) {
          return `📋 **Quy trình đặt phòng tại Vinaside:**\n\n1️⃣ **Tìm phòng:** Chọn phòng phù hợp với nhu cầu và ngân sách\n2️⃣ **Kiểm tra lịch:** Xem ngày trống và đặt lịch\n3️⃣ **Điền thông tin:** Cung cấp thông tin cá nhân và thanh toán\n4️⃣ **Xác nhận:** Nhận email xác nhận đặt phòng\n5️⃣ **Check-in:** Đến nhận phòng theo lịch đã đặt\n\n💳 **Thanh toán:** Chấp nhận VNPay, MoMo, tiền mặt\n📞 **Hỗ trợ:** Liên hệ 0909.123.456 để được tư vấn!`;
        }

        // Sử dụng AI để trả lời câu hỏi phức tạp
        this.logger.log(`Sử dụng AI trả lời câu hỏi: "${message}"`);
        const readableContext = this.formatDataForAI({
          listings,
          bookings,
          vouchers,
          services,
          reviews,
        });
        const prompt = this.chatbotService.buildPrompt(
          message,
          readableContext,
        );
        return this.chatbotService.generateResponse(prompt);
      }
    }
  }

  // Extract location from query - tìm địa điểm từ câu hỏi
  private extractLocationFromQuery(message: string): string | null {
    const msg = message.toLowerCase();

    // Danh sách từ khóa địa điểm - bổ sung thêm nhiều từ khóa hơn và các biến thể không dấu
    const locationKeywords = [
      // Đà Nẵng và các biến thể
      'đà nẵng',
      'da nang',
      'danang',

      // Hội An và các biến thể
      'hội an',
      'hoi an',
      'hoian',

      // Sơn Trà và các biến thể
      'sơn trà',
      'son tra',
      'sontra',

      // Các quận huyện Đà Nẵng
      'liên chiểu',
      'lien chieu',
      'thanh khê',
      'thanh khe',
      'cẩm lệ',
      'cam le',
      'hoà vang',
      'hoa vang',
      'ngũ hành sơn',
      'ngu hanh son',
      'hải châu',
      'hai chau',

      // Các khu vực khác
      'quảng ninh',
      'quang ninh',
      'tam đảo',
      'tam dao',
      'ninh bình',
      'ninh binh',

      // Các thành phố lớn
      'hồ chí minh',
      'ho chi minh',
      'sài gòn',
      'sai gon',
      'tphcm',
      'hà nội',
      'ha noi',
      'hanoi',
      'nha trang',
      'nhatrang',
      'đà lạt',
      'da lat',
      'dalat',
      'phú quốc',
      'phu quoc',
      'huế',
      'hue',
      'hạ long',
      'ha long',
      'halong',
      'vũng tàu',
      'vung tau',
      'vungtau',

      // Các quận ở TP.HCM
      'quận 1',
      'quan 1',
      'q1',
      'quận 2',
      'quan 2',
      'q2',
      'quận 3',
      'quan 3',
      'q3',
      'quận 4',
      'quan 4',
      'q4',
      'quận 5',
      'quan 5',
      'q5',
      'quận 7',
      'quan 7',
      'q7',

      // Các điểm đặc trưng
      'biển',
      'bien',
      'beach',
      'trung tâm',
      'trung tam',
      'center',
      'sân bay',
      'san bay',
      'airport',
      'chợ',
      'cho',
      'market',
      'bãi biển',
      'bai bien',
      'mỹ khê',
      'my khe',
      'bán đảo',
      'ban dao',
      'peninsula',
      'non nước',
      'non nuoc',
    ];

    // Log để debug
    this.logger.log(`Tìm kiếm từ khóa địa điểm trong: "${msg}"`);

    // Tìm từ khóa địa điểm trong câu hỏi
    const matchedLocation = locationKeywords.find((keyword) =>
      msg.includes(keyword),
    );

    // Log kết quả tìm kiếm
    this.logger.log(
      `Kết quả tìm kiếm địa điểm: ${matchedLocation || 'Không tìm thấy'}`,
    );

    return matchedLocation || null;
  }

  // Find rooms by location - tìm phòng theo vị trí
  private findRoomsByLocation(rooms: Listing[], location: string): Listing[] {
    // Chuẩn hóa location để tìm kiếm dễ dàng hơn
    const normalizedLocation = location.toLowerCase().trim();
    console.log(`Tìm kiếm phòng với địa điểm: ${normalizedLocation}`);

    return rooms.filter((room) => {
      if (!room.propertyId || typeof room.propertyId === 'string') {
        return false;
      }

      const property = room.propertyId;
      const propertyName = (property.name || '').toLowerCase();
      const propertyAddress = (property.location?.address || '').toLowerCase();
      const propertyCity = (property.location?.city || '').toLowerCase();
      const propertyDistrict = (
        property.location?.district || ''
      ).toLowerCase();

      // Log để debug
      console.log(
        `Phòng ${room.title} - Property: ${propertyName}, Địa chỉ: ${propertyAddress}, Thành phố: ${propertyCity}, Quận: ${propertyDistrict}`,
      );

      // Tìm theo nhiều trường khác nhau
      const matchesName = propertyName.includes(normalizedLocation);
      const matchesAddress = propertyAddress.includes(normalizedLocation);
      const matchesCity = propertyCity.includes(normalizedLocation);
      const matchesDistrict = propertyDistrict.includes(normalizedLocation);

      // Check nếu có bất kỳ trường nào trùng khớp
      return matchesName || matchesAddress || matchesCity || matchesDistrict;
    });
  }

  private handleRoomsByLocation(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    // Tìm vị trí được đề cập trong câu hỏi
    const locationMatch = this.extractLocationFromQuery(message);

    if (!locationMatch) {
      return 'Bạn muốn tìm phòng ở đâu? Vui lòng cho tôi biết thành phố hoặc khu vực cụ thể (ví dụ: Đà Nẵng, Hội An, Sơn Trà...)';
    }

    // Tìm các phòng ở vị trí đó
    const roomsInLocation = this.findRoomsByLocation(
      availableRooms,
      locationMatch,
    );

    if (roomsInLocation.length === 0) {
      return `Hiện không có phòng trống tại ${locationMatch}. Hãy thử tìm phòng ở các khu vực khác hoặc liên hệ để được tư vấn!`;
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

    return `🏖️ Phòng trống tại ${locationMatch}:\n\n${roomList}\n\n📞 Liên hệ 0909.123.456 để đặt phòng ngay!`;
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

    // Log để debug
    this.logger.log(`Tìm phòng theo tên trong: "${msg}"`);

    // Chỉ tìm kiếm theo tên phòng cụ thể, không dùng pattern chung chung
    const roomPatterns = [
      /phòng\s+(standard|deluxe|suite|family|vip|luxury|junior|executive|superior|premium)/i,
      /room\s+(standard|deluxe|suite|family|vip|luxury|junior|executive|superior|premium)/i,
      /(standard|deluxe|suite|family|vip|luxury|junior|executive|superior|premium)\s+room/i,
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

  // NEW: Handle comparison questions
  private handleComparisonQuestions(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    if (availableRooms.length < 2) {
      return 'Hiện tại chỉ có ít phòng trống, không thể so sánh. Hãy xem danh sách phòng hiện có hoặc liên hệ để được tư vấn!';
    }

    const topRooms = availableRooms.slice(0, 3);
    const comparison = topRooms
      .map((room, index) => {
        const property = room.propertyId;
        const address =
          typeof property === 'object'
            ? property?.location?.address || 'Đang cập nhật'
            : 'Đang cập nhật';
        const voucher = vouchers.find(
          (v) => room.voucher_ids?.includes(v._id) && v.is_active,
        );
        const priceInfo = voucher
          ? `${room.price_per_night.toLocaleString('vi-VN')}đ (giảm ${voucher.discount_percent}%)`
          : `${room.price_per_night.toLocaleString('vi-VN')}đ`;

        return `**${index + 1}. ${room.title}**\n📍 ${address}\n💰 ${priceInfo}/đêm\n👥 Tối đa ${room.max_guests || 2} khách`;
      })
      .join('\n\n');

    return `📊 **So sánh 3 phòng hàng đầu:**\n\n${comparison}\n\n💡 **Gợi ý:** Phòng giá rẻ nhất là phòng số 1. Bạn muốn xem chi tiết phòng nào?`;
  }

  // NEW: Handle attraction questions
  private handleAttractionQuestions(
    message: string,
    _availableRooms: Listing[],
  ): string {
    const msg = message.toLowerCase();

    if (msg.includes('gần') || msg.includes('nearby')) {
      return `🗺️ **Địa điểm nổi tiếng gần các phòng của chúng tôi:**\n\n🏖️ **Biển & Thiên nhiên:**\n• Biển Mỹ Khê (5-15 phút)\n• Bán đảo Sơn Trà (10-20 phút)\n• Ngũ Hành Sơn (15-25 phút)\n• Hội An cổ kính (30-45 phút)\n\n🏛️ **Văn hóa & Tâm linh:**\n• Chùa Linh Ứng (15-30 phút)\n• Bảo tàng Chăm (10-20 phút)\n• Chợ Hàn (5-15 phút)\n• Cầu Rồng (10-20 phút)\n\n🎢 **Giải trí:**\n• Ba Na Hills (45-60 phút)\n• Asian Park (20-30 phút)\n• Helio Center (15-25 phút)\n\n🏨 Tất cả phòng của chúng tôi đều có vị trí thuận lợi để tham quan!`;
    }

    return `🌟 **Top điểm đến phải thăm tại Đà Nẵng:**\n\n1️⃣ **Ngũ Hành Sơn** - Núi đá và hang động huyền bí\n2️⃣ **Bán đảo Sơn Trà** - Thiên đường xanh và voọc chà vá\n3️⃣ **Hội An** - Phố cổ đèn lồng lung linh\n4️⃣ **Ba Na Hills** - Cầu Vàng nổi tiếng thế giới\n5️⃣ **Biển Mỹ Khê** - Bãi biển đẹp nhất Việt Nam\n6️⃣ **Chùa Linh Ứng** - Tâm linh và view tuyệt đẹp\n\n📍 Tất cả đều gần với các phòng nghỉ của Vinaside!`;
  }

  // NEW: Handle transportation questions
  private handleTransportationQuestions(
    message: string,
    _availableRooms: Listing[],
  ): string {
    const msg = message.toLowerCase();

    if (msg.includes('sân bay') || msg.includes('airport')) {
      return `✈️ **Di chuyển từ sân bay Đà Nẵng:**\n\n🚗 **Taxi/Grab:**\n• Thời gian: 15-30 phút\n• Chi phí: 80,000-150,000đ\n• Tiện lợi nhất, đến tận nơi\n\n🚌 **Xe bus:**\n• Tuyến 601: Sân bay → Trung tâm\n• Chi phí: 20,000-30,000đ\n• Thời gian: 45-60 phút\n\n🏨 **Shuttle từ hotel:**\n• Miễn phí cho một số phòng\n• Cần đặt trước khi check-in\n• Liên hệ để kiểm tra\n\n📞 Gọi 0909.123.456 để được hỗ trợ đưa đón!`;
    }

    return `🚗 **Phương tiện di chuyển tại Đà Nẵng:**\n\n🏍️ **Thuê xe máy:**\n• Giá: 100,000-150,000đ/ngày\n• Linh hoạt, dễ đậu xe\n• Phù hợp tham quan gần\n\n🚗 **Thuê ô tô:**\n• Giá: 800,000-1,500,000đ/ngày\n• Có tài xế hoặc tự lái\n• Phù hợp gia đình, đi xa\n\n📱 **Grab/GoViet:**\n• Tiện lợi, an toàn\n• Bike: 15,000-30,000đ\n• Car: 30,000-80,000đ\n\n🚲 **Xe đạp:**\n• Giá: 50,000-80,000đ/ngày\n• Thân thiện môi trường\n• Phù hợp khu vực gần biển\n\n📍 Tất cả phòng của chúng tôi đều gần các điểm thuê xe!`;
  }

  // NEW: Handle food questions
  private handleFoodQuestions(
    message: string,
    _availableRooms: Listing[],
  ): string {
    const msg = message.toLowerCase();

    if (
      msg.includes('đặc sản') ||
      msg.includes('specialty') ||
      msg.includes('local')
    ) {
      return `🍜 **Đặc sản Đà Nẵng không thể bỏ qua:**\n\n🥢 **Món chính:**\n• Mì Quảng - Đặc sản số 1\n• Bún chả cá - Tươi ngon từ biển\n• Cao lầu - Từ Hội An gần đây\n• Bánh xèo - Giòn rụm thơm ngon\n\n🦐 **Hải sản:**\n• Chợ đêm Helio - Tôm càng xanh\n• Bãi biển Mỹ Khê - BBQ hải sản\n• Làng chài Thọ Quang - Tươi sống\n\n🍨 **Tráng miệng:**\n• Chè bắp - Đặc sản miền Trung\n• Kem flan - Mát lạnh ngày nóng\n• Bánh tráng nướng - Vỉa hè Đà Nẵng\n\n📍 Gần tất cả phòng của chúng tôi đều có quán ăn ngon!`;
    }

    return `🍽️ **Ăn gì tại Đà Nẵng:**\n\n⭐ **Quán nổi tiếng:**\n• Mì Quảng Bà Mua - 236 Lê Duẩn\n• Bún chả cá 199 - Đông Giang\n• Nem lụi Quyết Chiến - Trần Cao Vân\n• Bánh xèo Bà Dưỡng - Hoàng Diệu\n\n🌃 **Chợ đêm & Food court:**\n• Chợ đêm Helio - Hải sản BBQ\n• Con Market - Fusion food\n• Indochina Riverside - Fine dining\n• Memory Lounge - Rooftop view\n\n💰 **Giá tham khảo:**\n• Mì Quảng: 25,000-40,000đ\n• Hải sản: 200,000-500,000đ/kg\n• Bánh tráng nướng: 5,000-10,000đ\n\n🏨 Nhiều phòng của chúng tôi gần khu ẩm thực sầm uất!`;
  }

  // NEW: Handle business questions
  private handleBusinessQuestions(
    message: string,
    availableRooms: Listing[],
    services: any[],
  ): string {
    const businessRooms = availableRooms.filter(
      (room) => room.max_guests && room.max_guests >= 4,
    );

    if (businessRooms.length === 0) {
      return 'Hiện tại không có phòng phù hợp cho nhóm lớn. Vui lòng liên hệ để được tư vấn phòng phù hợp cho business trip!';
    }

    const businessServices = services.filter((service) => {
      const name = service.name as string;
      return (
        name &&
        (name.toLowerCase().includes('meeting') ||
          name.toLowerCase().includes('conference') ||
          name.toLowerCase().includes('business'))
      );
    });

    // Sử dụng businessServices để không bị unused
    const businessServiceCount = businessServices.length;

    return `💼 **Phòng phù hợp cho Business Travel:**\n\n🏢 **Phòng cho nhóm:**\n${businessRooms
      .slice(0, 3)
      .map((room, index) => {
        const property = room.propertyId;
        const address =
          typeof property === 'object'
            ? property?.location?.address || 'Đang cập nhật'
            : 'Đang cập nhật';
        return `${index + 1}. **${room.title}**\n   📍 ${address}\n   👥 ${room.max_guests} người\n   💰 ${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
      })
      .join(
        '\n\n',
      )}\n\n🛎️ **Dịch vụ Business:**\n• WiFi tốc độ cao\n• Máy in, scan, fax\n• Meeting room (theo yêu cầu)\n• Breakfast catering\n• Airport pickup\n\n📞 Liên hệ 0909.123.456 để đặt phòng và dịch vụ business!`;
  }

  // NEW: Handle romantic questions
  private handleRomanticQuestions(
    message: string,
    availableRooms: Listing[],
    vouchers: Voucher[],
  ): string {
    const romanticRooms = availableRooms.filter(
      (room) =>
        room.view_type === 'sea' ||
        room.title.toLowerCase().includes('deluxe') ||
        room.title.toLowerCase().includes('suite'),
    );

    if (romanticRooms.length === 0) {
      return 'Hiện tại chúng tôi đang cập nhật các phòng romantic. Vui lòng liên hệ để được tư vấn phòng phù hợp cho cặp đôi!';
    }

    const activeVouchers = vouchers.filter((v) => v.is_active);

    return `💕 **Phòng lãng mạn cho cặp đôi:**\n\n🌊 **Sea View Rooms:**\n${romanticRooms
      .slice(0, 2)
      .map((room, index) => {
        const property = room.propertyId;
        const address =
          typeof property === 'object'
            ? property?.location?.address || 'Đang cập nhật'
            : 'Đang cập nhật';
        return `${index + 1}. **${room.title}**\n   🌅 View: ${room.view_type || 'Đẹp'}\n   📍 ${address}\n   💰 ${room.price_per_night.toLocaleString('vi-VN')}đ/đêm`;
      })
      .join(
        '\n\n',
      )}\n\n💎 **Romantic Package:**\n• Trang trí phòng với hoa hồng\n• Champagne & chocolate\n• Dinner view biển\n• Couple spa treatment\n• Photography service\n\n🎁 **Ưu đãi hiện tại:**\n${
      activeVouchers.length > 0
        ? activeVouchers
            .slice(0, 2)
            .map((v) => `• ${v.code}: Giảm ${v.discount_percent}%`)
            .join('\n')
        : '• Liên hệ để biết ưu đãi mới nhất'
    }\n\n📞 Gọi 0909.123.456 để đặt phòng romantic ngay!`;
  }

  // NEW: Handle AI questions for complex queries
  private async handleAIQuestion(
    message: string,
    data: {
      listings: Listing[];
      bookings: any[];
      vouchers: Voucher[];
      services: any[];
      reviews: Review[];
    },
  ): Promise<string> {
    try {
      // Format data in readable format for Gemini
      const readableContext = this.formatDataForAI(data);
      const prompt = this.chatbotService.buildPrompt(message, readableContext);
      return await this.chatbotService.generateResponse(prompt);
    } catch (error) {
      this.logger.error('Error with AI question:', error);
      return 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này. Vui lòng thử lại hoặc liên hệ 0909.123.456 để được hỗ trợ trực tiếp!';
    }
  }

  private formatDataForAI(data: {
    listings: Listing[];
    bookings: any[];
    vouchers: Voucher[];
    services: any[];
    reviews: Review[];
  }): string {
    let context = '';

    // Giới hạn số lượng dữ liệu để tránh vượt quá limit của API
    const maxListings = 5;
    const maxVouchers = 3;
    const maxServices = 3;
    const maxReviews = 3;
    const maxDescriptionLength = 50; // Giảm độ dài mô tả để giảm kích thước payload

    // Format listings information
    if (data.listings.length > 0) {
      context += 'PHÒNG:\n';
      data.listings.slice(0, maxListings).forEach((room, index) => {
        const property = room.propertyId;
        const propertyInfo = typeof property === 'object' ? property : null;

        context += `${index + 1}. ${room.title}\n`;
        context += `   - Giá: ${room.price_per_night.toLocaleString('vi-VN')}đ\n`;
        context += `   - Khách: ${room.max_guests || 2} người\n`;

        if (propertyInfo && propertyInfo.location?.address) {
          context += `   - Địa chỉ: ${propertyInfo.location.address}\n`;
        }

        if (room.description) {
          context += `   - Mô tả: ${room.description.substring(0, maxDescriptionLength)}...\n`;
        }
      });
    }

    // Format vouchers information
    if (data.vouchers.length > 0) {
      context += '\nVOUCHER:\n';
      const activeVouchers = data.vouchers
        .filter((v) => v.is_active)
        .slice(0, maxVouchers);
      activeVouchers.forEach((voucher, index) => {
        context += `${index + 1}. ${voucher.code}: Giảm ${voucher.discount_percent}%\n`;
      });
    }

    // Format services information - chỉ tên dịch vụ
    if (data.services.length > 0) {
      context += '\nDỊCH VỤ:\n';
      data.services.slice(0, maxServices).forEach((service, index) => {
        context += `${index + 1}. ${(service as { name: string }).name}\n`;
      });
    }

    // Format reviews information - chỉ rating
    if (data.reviews.length > 0) {
      context += '\nĐÁNH GIÁ:\n';
      data.reviews.slice(0, maxReviews).forEach((review, index) => {
        context += `${index + 1}. ${review.rating}/5 sao\n`;
      });
    }

    // Đảm bảo kích thước không quá lớn
    if (context.length > 5000) {
      context = context.substring(0, 5000) + '...';
    }

    return context || 'Hiện tại chưa có dữ liệu về các phòng và dịch vụ.';
  }
}
