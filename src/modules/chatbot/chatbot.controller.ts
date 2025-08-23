import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AIChatbotService } from './ai-chatbot.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GuestOrPermissionGuard } from '../../common/guards/guest-or-permission.guard';
import { CreateChatbotMessageDto } from './dto/bot-message.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import {
  extractSlotsFromText,
  mergeSlots,
  missingForSearch,
  isCompleteForSearch,
  buildAsk,
  formatDateForDisplay,
  isSessionExpired,
  isGeneralInfoRequest,
  isServiceRequest,
  isVoucherRequest,
  isCancellationPolicyRequest,
  isPaymentMethodsRequest,
  isBookingProcessRequest,
  Slots,
} from './helpers/slots';
import { ResponseFormatter } from './response-formatter';
import axios from 'axios';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ChatbotController {
  private logger: Logger = new Logger('ChatbotController');

  constructor(
    private readonly aiChatbotService: AIChatbotService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // Session management methods (similar to WebSocket gateway)
  private sessionKey(userId: string) {
    return `chatbot:session:${userId}`;
  }

  private async loadSession(userId: string): Promise<any | null> {
    const key = this.sessionKey(userId);
    this.logger.log(`[DEBUG] Loading session with key: ${key}`);
    const raw = await this.redis.get(key);
    const session = raw ? JSON.parse(raw) : null;
    this.logger.log(
      `[DEBUG] Loading session for ${userId}: ${JSON.stringify(session)}`,
    );
    return session;
  }

  private async saveSession(userId: string, session: any): Promise<void> {
    const key = this.sessionKey(userId);
    this.logger.log(`[DEBUG] Saving session with key: ${key}`);
    this.logger.log(
      `[DEBUG] Saving session for ${userId}: ${JSON.stringify(session)}`,
    );
    await this.redis.set(key, JSON.stringify(session), 'EX', 60 * 60 * 6);
  }

  private async findAvailableRooms(slots: Slots): Promise<any[]> {
    try {
      this.logger.log(
        `Finding available rooms with slots: ${JSON.stringify(slots)}`,
      );

      // Fetch internal data
      const response = await axios.get(
        'http://localhost:8080/api/v1/internal-data',
      );
      const internalData = response.data;

      const { listings, bookings } = internalData.data;
      this.logger.log(
        `Fetched ${listings.length} listings and ${bookings.length} bookings`,
      );

      // Filter by city if specified
      let filteredListings = listings;
      if (slots.city) {
        filteredListings = listings.filter((listing: any) => {
          const propertyCity = listing.propertyId?.location?.city;
          const propertyName = listing.propertyId?.name;

          // Normalize city names for better matching
          const normalize = (s: string) =>
            s
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

          const cityMatches =
            propertyCity &&
            (normalize(propertyCity).includes(normalize(slots.city!)) ||
              normalize(slots.city!).includes(normalize(propertyCity)));

          const nameMatches =
            propertyName &&
            normalize(propertyName).includes(normalize(slots.city!));

          return cityMatches || nameMatches;
        });
        this.logger.log(
          `After city filter: ${filteredListings.length} listings`,
        );
      }

      // Filter by availability
      const availableRooms = filteredListings.filter((room: any) => {
        // Check if room is active
        if (room.status !== 'active') {
          return false;
        }

        // Check booking conflicts if dates are specified
        if (slots.checkIn && slots.checkOut) {
          const checkIn = new Date(slots.checkIn);
          const checkOut = new Date(slots.checkOut);

          const conflictingBookings = bookings.filter(
            (booking: any) =>
              booking.listingId === room._id &&
              ['confirmed', 'completed'].includes(booking.status) &&
              new Date(booking.checkInDate) < checkOut &&
              new Date(booking.check_out_date) > checkIn,
          );

          if (conflictingBookings.length > 0) {
            return false;
          }
        }

        // Check guest capacity if specified
        if (slots.guests && room.max_guests && slots.guests > room.max_guests) {
          return false;
        }

        return true;
      });

      this.logger.log(`Found ${availableRooms.length} available rooms`);
      return availableRooms.slice(0, 10); // Limit to 10 results
    } catch (error) {
      this.logger.error('Error finding available rooms:', error);
      return [];
    }
  }

  private async handleServiceRequest() {
    try {
      // Fetch internal data to get services
      const response = await axios.get(
        'http://localhost:8080/api/v1/internal-data',
      );
      const { services } = response.data.data;

      if (!services || services.length === 0) {
        return {
          type: 'text',
          text: 'Hiện tại chưa có thông tin dịch vụ. Vui lòng liên hệ 0909.123.456 để được tư vấn!',
        };
      }

      // Convert services to listing format
      const serviceItems = services.map((service: any) => ({
        id: service._id,
        title: service.name,
        pricePerNight: service.default_price,
        address: 'Dịch vụ tại chỗ',
        imageUrl: 'https://example.com/service-icon.png',
        detailUrl: null, // Không có chi tiết
        tags: ['Dịch vụ', 'Tại chỗ'],
        totalPrice: service.default_price,
        description: service.description || 'Dịch vụ chất lượng cao',
      }));

      return {
        type: 'listings',
        header: '🎉 Dịch vụ tại chỗ',
        meta: { total: serviceItems.length },
        items: serviceItems,
        // Không có CTA
      };
    } catch (error) {
      this.logger.error('Error handling service request:', error);
      return {
        type: 'text',
        text: 'Xin lỗi, có lỗi xảy ra khi tải thông tin dịch vụ. Vui lòng thử lại sau!',
      };
    }
  }

  private async handleVoucherRequest() {
    try {
      // Fetch internal data to get vouchers
      const response = await axios.get(
        'http://localhost:8080/api/v1/internal-data',
      );
      const { vouchers } = response.data.data;

      if (!vouchers || vouchers.length === 0) {
        return {
          type: 'text',
          text: 'Hiện tại chưa có voucher khuyến mãi. Vui lòng theo dõi Fanpage để cập nhật ưu đãi mới nhất!',
        };
      }

      // Filter active vouchers only
      const activeVouchers = vouchers.filter(
        (voucher: any) => voucher.is_active,
      );

      if (activeVouchers.length === 0) {
        return {
          type: 'text',
          text: 'Hiện tại không có voucher đang hoạt động. Vui lòng theo dõi Fanpage để cập nhật ưu đãi mới nhất!',
        };
      }

      // Convert vouchers to listing format
      const voucherItems = activeVouchers.map((voucher: any) => ({
        id: voucher._id,
        title: `Voucher ${voucher.code}`,
        pricePerNight: voucher.min_order_value,
        address: `Giảm ${voucher.discount_percent}%`,
        imageUrl: 'https://example.com/voucher-icon.png',
        detailUrl: null, // Không có chi tiết
        tags: ['Voucher', 'Khuyến mãi'],
        totalPrice: voucher.min_order_value,
        description: `Giảm ${voucher.discount_percent}% cho đơn hàng tối thiểu ${voucher.min_order_value.toLocaleString('vi-VN')}đ. Hết hạn: ${new Date(voucher.expiration_date).toLocaleDateString('vi-VN')}`,
      }));

      return {
        type: 'listings',
        header: '🎁 Voucher khuyến mãi',
        meta: { total: voucherItems.length },
        items: voucherItems,
        // Không có CTA
      };
    } catch (error) {
      this.logger.error('Error handling voucher request:', error);
      return {
        type: 'text',
        text: 'Xin lỗi, có lỗi xảy ra khi tải thông tin voucher. Vui lòng thử lại sau!',
      };
    }
  }

  private handleCancellationPolicyRequest() {
    return {
      type: 'text',
      text: `📋 **Chính sách hủy phòng:**

🛎 Nhận phòng: ngày check-in theo đặt phòng.

✅ Hủy trước 14:00 ngày hôm trước khi nhận phòng: Hoàn tiền đầy đủ.

❌ Hủy sau thời điểm trên hoặc không đến nhận phòng: Tính phí đêm đầu tiên.

📞 Liên hệ: 0909.123.456 để được hỗ trợ thêm!`,
    };
  }

  @Post('message')
  @UseGuards(GuestOrPermissionGuard)
  @ApiOperation({
    summary: 'Gửi tin nhắn đến chatbot',
    description: 'Gửi tin nhắn và nhận phản hồi từ AI chatbot.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tin nhắn được xử lý thành công và trả về phản hồi từ AI.',
  })
  @ResponseMessage('Gửi tin nhắn thành công')
  async sendMessage(
    @Body() createChatbotMessageDto: CreateChatbotMessageDto,
    @Request() req: RequestWithUser,
  ) {
    const message = createChatbotMessageDto.content;
    const userId = req.user?._id || 'anonymous';

    this.logger.log(`Processing message from user ${userId}: "${message}"`);

    try {
      // === CHATBOT FLOW: load → extract → merge → save → if missing ask once → else search/hold ===

      // 1) LOAD: Load session state
      let session = (await this.loadSession(userId)) || {
        userId: userId,
        slots: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check if session is expired and clear context if needed
      if (isSessionExpired(session)) {
        this.logger.log(
          `[DEBUG] Session expired, clearing context for user ${userId}`,
        );
        session = {
          userId: userId,
          slots: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      this.logger.log(
        `[DEBUG] Loaded session slots: ${JSON.stringify(session.slots)}`,
      );

      // 2) EXTRACT: Extract slots from current message
      const newSlots = extractSlotsFromText(message, new Date());
      this.logger.log(
        `[DEBUG] Extracted new slots: ${JSON.stringify(newSlots)}`,
      );

      // 3) MERGE: Merge new slots with existing session
      session.slots = mergeSlots(session.slots || {}, newSlots, message);
      this.logger.log(`[DEBUG] Merged slots: ${JSON.stringify(session.slots)}`);

      // 4) SAVE: Save updated session
      session.updatedAt = new Date();
      await this.saveSession(userId, session);

      // 5) CHECK MISSING: Check what's still missing
      const lacks = missingForSearch(session.slots, message);
      this.logger.log(`[DEBUG] Missing slots: ${JSON.stringify(lacks)}`);
      this.logger.log(`[DEBUG] isCompleteForSearch: ${lacks.length === 0}`);

      // 6) CHECK FOR SERVICE REQUEST
      if (isServiceRequest(message)) {
        this.logger.log(`[DEBUG] Service request detected: "${message}"`);
        return await this.handleServiceRequest();
      }

      // 7) CHECK FOR VOUCHER REQUEST
      if (isVoucherRequest(message)) {
        this.logger.log(`[DEBUG] Voucher request detected: "${message}"`);
        return await this.handleVoucherRequest();
      }

      // 8) CHECK FOR CANCELLATION POLICY REQUEST
      if (isCancellationPolicyRequest(message)) {
        this.logger.log(
          `[DEBUG] Cancellation policy request detected: "${message}"`,
        );
        return this.handleCancellationPolicyRequest();
      }

      // 9) CHECK FOR PAYMENT METHODS REQUEST
      if (isPaymentMethodsRequest(message)) {
        this.logger.log(
          `[DEBUG] Payment methods request detected: "${message}"`,
        );
        return this.handlePaymentMethodsRequest();
      }

      // 10) CHECK FOR BOOKING PROCESS REQUEST
      if (isBookingProcessRequest(message)) {
        this.logger.log(
          `[DEBUG] Booking process request detected: "${message}"`,
        );
        return this.handleBookingProcessRequest();
      }

      // 11) CHECK FOR GENERAL INFO REQUEST (before room detail)
      if (isGeneralInfoRequest(message)) {
        this.logger.log(`[DEBUG] General info request detected: "${message}"`);
        // Use AI service to handle general info requests
        return this.aiChatbotService.processMessage(message);
      }

      // 12) CHECK FOR ROOM DETAIL REQUEST
      if (session.slots.roomName) {
        const roomName = session.slots.roomName;
        this.logger.log(`[DEBUG] Room detail request for: ${roomName}`);

        // Fetch internal data to find the specific room
        const response = await axios.get(
          'http://localhost:8080/api/v1/internal-data',
        );
        const { listings, vouchers, reviews } = response.data.data;

        // Find the specific room
        const targetRoom = listings.find(
          (room: any) =>
            room.title.toLowerCase().includes(roomName.toLowerCase()) ||
            roomName.toLowerCase().includes(room.title.toLowerCase()),
        );

        if (targetRoom) {
          // Return as listings format with single room for detail view
          const listingsMessage = ResponseFormatter.formatListingsResponse(
            [targetRoom], // Single room array
            session.slots.checkIn,
            session.slots.checkOut,
            session.slots.guests,
            session.slots.city,
            'book_now',
          );

          // Override header to indicate it's a detail view
          listingsMessage.header = `Chi tiết ${targetRoom.title}`;

          return listingsMessage;
        } else {
          // Return error as text response
          return {
            type: 'text',
            text: `Không tìm thấy phòng "${roomName}". Vui lòng kiểm tra lại tên phòng hoặc liên hệ 0909.123.456 để được tư vấn!`,
          };
        }
      }

      // 13) IF MISSING: Ask once for missing info
      if (lacks.length > 0) {
        const askResponse = buildAsk(session.slots, lacks);
        this.logger.log(`[DEBUG] Asking for missing info: ${askResponse.text}`);
        return askResponse;
      }

      // 14) ELSE SEARCH: Slots complete, search for rooms
      this.logger.log(
        `[DEBUG] Slots đầy đủ, tìm phòng với: ${JSON.stringify(session.slots)}`,
      );

      // Tìm phòng dựa trên slots
      const availableRooms = await this.findAvailableRooms(session.slots);

      if (availableRooms && availableRooms.length > 0) {
        const listingsMessage = ResponseFormatter.formatListingsResponse(
          availableRooms,
          session.slots.checkIn,
          session.slots.checkOut,
          session.slots.guests,
          session.slots.city,
          'book_now',
        );

        return listingsMessage;
      } else {
        // No rooms found but slots are complete - return availability response
        const noRoomsMessage = ResponseFormatter.formatAvailabilityResponse(
          `Hiện tại không có phòng trống tại ${session.slots.city} cho ngày ${session.slots.checkIn} đến ${session.slots.checkOut} với ${session.slots.guests} khách. Vui lòng thử ngày khác hoặc liên hệ 0909.123.456 để được hỗ trợ!`,
          {
            city: session.slots.city,
            checkIn: session.slots.checkIn,
            checkOut: session.slots.checkOut,
            guests: session.slots.guests,
            nights: session.slots.nights,
          },
        );

        return noRoomsMessage;
      }
    } catch (error) {
      this.logger.error('Error processing message:', error);

      // Fallback to AI service for complex queries
      return this.aiChatbotService.processMessage(message);
    }
  }

  private handlePaymentMethodsRequest() {
    return {
      type: 'text',
      text: `💳 Hình thức thanh toán:

Thanh toán online qua VNPAY (an toàn, nhanh chóng).

Thanh toán trực tiếp khi nhận phòng.

✅ Tất cả đều an toàn và được bảo mật!
📞 Liên hệ 0909.123.456 để được hướng dẫn chi tiết!`,
    };
  }

  private handleBookingProcessRequest() {
    return {
      type: 'text',
      text: `✨ Quy trình đặt phòng tại Vinaside ✨

1. Tìm kiếm
Truy cập website www.vinaside.com hoặc gọi hotline 0909.123.456 để tìm homestay phù hợp theo địa điểm, thời gian và số lượng khách.

2. Chọn phòng
Xem thông tin chi tiết về phòng, tiện nghi và giá cả, sau đó chọn phòng ưng ý.

3. Đặt phòng
Điền thông tin đặt phòng và gửi yêu cầu.

4. Xác nhận
Đội ngũ Vinaside sẽ liên hệ với bạn để xác nhận thông tin và hoàn tất thủ tục nhanh chóng.

👉 Bạn muốn tìm homestay ở khu vực nào ạ?`,
    };
  }
}
