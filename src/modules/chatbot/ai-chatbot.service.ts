import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChatbotConfig } from '../../configs/chatbot.config';
import { BotMessage, BotMessageType } from './dto/bot-message.dto';
import { ListingService } from '../listing/listing.service';
import { ResponseFormatter } from './response-formatter';

interface SlotExtraction {
  intent: string;
  slots: {
    location?: string;
    checkInDate?: string;
    checkOutDate?: string;
    nights?: number;
    guests?: number;
    roomType?: string;
    budget?: number;
  };
  confidence: number;
}

interface AIResponse {
  type: 'text' | 'listings' | 'function_call';
  content: string;
  function_call?: {
    name: string;
    arguments: any;
  };
  slots?: SlotExtraction;
}

@Injectable()
export class AIChatbotService {
  private readonly config: ChatbotConfig;
  private readonly logger = new Logger(AIChatbotService.name);

  constructor(
    private configService: ConfigService,
    private listingService: ListingService,
  ) {
    const config = this.configService.get<ChatbotConfig>('chatbot');
    if (!config) {
      throw new Error('Chatbot configuration not found');
    }
    this.config = config;
  }

  /**
   * Process user message using AI with system instruction and function calling
   */
  async processMessage(userMessage: string): Promise<BotMessage> {
    try {
      this.logger.log(`Processing message: ${userMessage}`);

      // Step 1: Extract intent and slots using AI
      const slotExtraction = await this.extractIntentAndSlots(userMessage);
      this.logger.log(`Extracted slots:`, slotExtraction);

      // Step 2: Determine response type and generate response
      const aiResponse = await this.generateAIResponse(
        userMessage,
        slotExtraction,
      );
      this.logger.log(`AI Response type: ${aiResponse.type}`);

      // Step 3: Execute function calls if needed
      if (aiResponse.type === 'function_call' && aiResponse.function_call) {
        return await this.executeFunctionCall(
          aiResponse.function_call,
          slotExtraction,
        );
      }

      // Step 4: Format response
      if (aiResponse.type === 'listings') {
        return this.formatListingsResponse(aiResponse.content, slotExtraction);
      }

      return ResponseFormatter.formatTextResponse(aiResponse.content);
    } catch (error) {
      this.logger.error('Error processing message:', error);
      return ResponseFormatter.formatTextResponse(
        `Xin lỗi, có lỗi xảy ra trong quá trình xử lý tin nhắn.

**Hỗ trợ khẩn cấp:**
Vui lòng thử lại sau hoặc liên hệ ${this.config.contact.phone} để được hỗ trợ trực tiếp.`,
      );
    }
  }

  /**
   * Extract intent and slots using AI with structured output
   */
  private async extractIntentAndSlots(
    userMessage: string,
  ): Promise<SlotExtraction> {
    const systemPrompt = this.buildSystemInstruction();

    const prompt = `
${systemPrompt}

TASK: Extract intent and slots from user message.

USER MESSAGE: "${userMessage}"

RESPOND WITH JSON ONLY:
{
  "intent": "check_available_rooms|ask_general_info|book_room|ask_pricing|ask_location_info",
  "slots": {
    "location": "string or null",
    "checkInDate": "YYYY-MM-DD or null", 
    "checkOutDate": "YYYY-MM-DD or null",
    "nights": "number or null",
    "guests": "number or null",
    "roomType": "string or null",
    "budget": "number or null"
  },
  "confidence": 0.0-1.0
}

EXAMPLES:
- "Tôi muốn đặt phòng ngày 24/8 ở Ninh Bình, ở 2 đêm, đi 1 người"
  → {"intent": "check_available_rooms", "slots": {"location": "Ninh Bình", "checkInDate": "2024-08-24", "nights": 2, "guests": 1}, "confidence": 0.95}

- "Có phòng nào ở Hồ Chí Minh không?"
  → {"intent": "check_available_rooms", "slots": {"location": "Hồ Chí Minh"}, "confidence": 0.9}

- "Xin chào"
  → {"intent": "ask_general_info", "slots": {}, "confidence": 0.8}
`;

    try {
      const response = await this.callGeminiAPI(prompt, true);
      // Clean the response to remove markdown formatting
      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);
      return parsed as SlotExtraction;
    } catch (error) {
      this.logger.error('Error extracting slots:', error);
      // Fallback to basic extraction
      return {
        intent: 'ask_general_info',
        slots: {},
        confidence: 0.5,
      };
    }
  }

  /**
   * Generate AI response with function calling capabilities
   */
  private async generateAIResponse(
    userMessage: string,
    slots: SlotExtraction,
  ): Promise<AIResponse> {
    const systemPrompt = this.buildSystemInstruction();

    const availableFunctions = this.getAvailableFunctions();

    const prompt = `
${systemPrompt}

AVAILABLE FUNCTIONS:
${JSON.stringify(availableFunctions, null, 2)}

EXTRACTED SLOTS: ${JSON.stringify(slots, null, 2)}

USER MESSAGE: "${userMessage}"

TASK: Determine if you should call a function or provide a text response.

RESPOND WITH JSON ONLY:
{
  "type": "text|listings|function_call",
  "content": "your response text",
  "function_call": {
    "name": "function_name",
    "arguments": {}
  }
}

 RULES:
 1. If user asks about room availability with location, call check_available_rooms_by_location
 2. If user provides complete booking info (date, location, nights, guests), call check_available_rooms_complete_info
 3. If user asks about vouchers, promotions, or discount codes, call get_voucher_info
 4. If user asks about services, call get_service_info
 5. If user asks about amenities, facilities, or room features, call get_amenities_info
 6. If user asks about both services and vouchers together, call get_combined_info
 7. If user asks "Chi tiết + (tên phòng)" or "Xem chi tiết phòng + (tên)", call get_listing_details with roomName
 8. If user asks about specific listings by ID, call get_listing_details with listingId
 9. If user asks general questions, provide text response
`;

    try {
      const response = await this.callGeminiAPI(prompt, true);
      // Clean the response to remove markdown formatting
      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);
      return parsed as AIResponse;
    } catch (error) {
      this.logger.error('Error generating AI response:', error);
      return {
        type: 'text',
        content: `Xin lỗi, có lỗi xảy ra trong quá trình xử lý.

**Hỗ trợ:**
Vui lòng thử lại sau hoặc liên hệ ${this.config.contact.phone} để được hỗ trợ.`,
      };
    }
  }

  /**
   * Execute function calls based on AI decision
   */
  private async executeFunctionCall(
    functionCall: any,
    slots: SlotExtraction,
  ): Promise<BotMessage> {
    const { name, arguments: args } = functionCall;

    switch (name) {
      case 'check_available_rooms_by_location':
        return await this.checkAvailableRoomsByLocation(
          args.location || slots.slots.location,
        );

      case 'check_available_rooms_complete_info':
        return await this.checkAvailableRoomsWithCompleteInfo(
          args.checkInDate || slots.slots.checkInDate,
          args.location || slots.slots.location,
          args.nights || slots.slots.nights,
          args.guests || slots.slots.guests,
        );

      case 'get_listing_details':
        return await this.getListingDetails(args.listingId, args.roomName);

      case 'get_voucher_info':
        return await this.getVoucherInfo();

      case 'get_service_info':
        return await this.getServiceInfo();

      case 'get_amenities_info':
        return await this.getAmenitiesInfo();

      case 'get_combined_info':
        return await this.getCombinedInfo();

      default:
        this.logger.warn(`Unknown function call: ${name}`);
        return ResponseFormatter.formatTextResponse(
          `Xin lỗi, tôi không hiểu yêu cầu của bạn.

**Hỗ trợ:**
Vui lòng thử lại với cách diễn đạt khác hoặc liên hệ ${this.config.contact.phone} để được hỗ trợ.`,
        );
    }
  }

  /**
   * Check available rooms by location
   */
  private async checkAvailableRoomsByLocation(
    location: string,
  ): Promise<BotMessage> {
    try {
      this.logger.log(`Checking available rooms in ${location}`);

      const queryDto = {
        city: location,
        checkAvailability: true,
        page: 1,
        limit: 10,
      };

      const result = await this.listingService.findAll(queryDto);

      if (!result.listings || result.listings.length === 0) {
        return ResponseFormatter.formatTextResponse(
          `Chào bạn! Vinaside rất vui được hỗ trợ bạn tìm phòng homestay tại ${location}.

**Thông tin cần thiết:**
Để tìm được phòng phù hợp nhất, bạn cho mình biết thêm thông tin nhé:

1. **Ngày nhận phòng**: Bạn muốn nhận phòng ngày nào?
2. **Số đêm**: Bạn ở mấy đêm?
3. **Số khách**: Bạn đi mấy người?

Sau khi có đủ thông tin, mình sẽ giúp bạn tìm phòng phù hợp và báo giá chi tiết.`,
        );
      }

      return ResponseFormatter.formatListingsResponse(
        result.listings,
        undefined,
        undefined,
        undefined,
        location,
        undefined,
      );
    } catch (error) {
      this.logger.error('Error checking available rooms by location:', error);
      return ResponseFormatter.formatTextResponse(
        `Chào bạn! Vinaside rất vui được hỗ trợ bạn tìm phòng homestay tại ${location}.

**Thông tin cần thiết:**
Để tìm được phòng phù hợp nhất, bạn cho mình biết thêm thông tin nhé:

1. **Ngày nhận phòng**: Bạn muốn nhận phòng ngày nào?
2. **Số đêm**: Bạn ở mấy đêm?
3. **Số khách**: Bạn đi mấy người?

Sau khi có đủ thông tin, mình sẽ giúp bạn tìm phòng phù hợp và báo giá chi tiết.`,
      );
    }
  }

  /**
   * Check available rooms with complete booking information
   */
  public async checkAvailableRoomsWithCompleteInfo(
    checkInDate: string,
    location: string,
    nights: number,
    guests: number,
  ): Promise<BotMessage> {
    try {
      this.logger.log(
        `Checking available rooms for ${checkInDate} at ${location}, ${nights} nights, ${guests} guests`,
      );

      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + nights);
      const checkOutDate = checkOut.toISOString().split('T')[0];

      const queryDto = {
        city: location,
        checkAvailability: true,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        guests: guests,
        page: 1,
        limit: 10,
      };

      const result = await this.listingService.findAll(queryDto);

      if (!result.listings || result.listings.length === 0) {
        return ResponseFormatter.formatTextResponse(
          `Xin lỗi, không có phòng trống cho ${guests} người từ ${checkInDate} đến ${checkOutDate} tại ${location}.

**Các lựa chọn thay thế:**
Bạn có thể thử các cách sau:

1. **Thay đổi ngày**: Thử ngày khác trong tháng
2. **Thay đổi số đêm**: Giảm hoặc tăng số đêm
3. **Tìm khu vực khác**: Các homestay gần đó

**Hỗ trợ trực tiếp:**
Liên hệ ${this.config.contact.phone} để được tư vấn thêm và tìm phòng phù hợp.`,
        );
      }

      return ResponseFormatter.formatListingsResponse(
        result.listings,
        checkInDate,
        checkOutDate,
        guests,
        location,
        undefined,
      );
    } catch (error) {
      this.logger.error(
        'Error checking available rooms with complete info:',
        error,
      );
      return ResponseFormatter.formatTextResponse(
        `Xin lỗi, có lỗi xảy ra khi kiểm tra phòng trống.

**Hỗ trợ khẩn cấp:**
Vui lòng thử lại sau hoặc liên hệ ${this.config.contact.phone} để được hỗ trợ trực tiếp.`,
      );
    }
  }

  /**
   * Get listing details
   */
  public async getListingDetails(
    listingId?: string,
    roomName?: string,
  ): Promise<BotMessage> {
    try {
      this.logger.log(`Getting listing details for: ${listingId || roomName}`);

      let queryDto: any = {
        page: 1,
        limit: 10,
      };

      if (listingId) {
        // Search by listing ID
        queryDto.listingId = listingId;
      } else if (roomName) {
        // Search by room name
        queryDto.title = roomName;
      } else {
        return ResponseFormatter.formatTextResponse(
          `Vui lòng cung cấp tên phòng hoặc ID phòng để xem chi tiết.

Ví dụ:
- "Chi tiết phòng Đôi"
- "Xem thông tin phòng Ocean View"
- "Phòng Bus Room có gì?"

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn chi tiết.`,
        );
      }

      const result = await this.listingService.findAll(queryDto);

      if (!result.listings || result.listings.length === 0) {
        // Fallback: accent-insensitive fuzzy matching on a broader dataset
        const normalize = (s: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ') // collapse spaces
            .trim();

        const normalizedTarget = normalize(roomName || '');

        // Try different search strategies
        let broad;
        try {
          // First try with a larger limit
          broad = await this.listingService.findAll({
            page: 1,
            limit: 500,
          });
        } catch (error) {
          // Fallback to smaller limit
          broad = await this.listingService.findAll({
            page: 1,
            limit: 200,
          });
        }

        const matched = (broad.listings || []).filter((l: any) => {
          const title = normalize(l.title);
          const propertyName = normalize(l.propertyId?.name || '');

          // Split target into words for better matching
          const targetWords = normalizedTarget
            .split(' ')
            .filter((word) => word.length > 1);

          // Check if any target word is in title or property name
          const titleMatch = targetWords.some(
            (word) => title.includes(word) || word.includes(title),
          );
          const propertyMatch = targetWords.some(
            (word) =>
              propertyName.includes(word) || word.includes(propertyName),
          );

          // Also check full string matching
          const fullMatch =
            title.includes(normalizedTarget) ||
            propertyName.includes(normalizedTarget) ||
            normalizedTarget.includes(title) ||
            normalizedTarget.includes(propertyName);

          return titleMatch || propertyMatch || fullMatch;
        });

        if (!matched.length) {
          // Try one more search with different approach
          const allListings = broad.listings || [];
          const partialMatches = allListings.filter((l: any) => {
            const title = (l.title || '').toLowerCase();
            const propertyName = (l.propertyId?.name || '').toLowerCase();
            const searchTerm = (roomName || '').toLowerCase();

            // Check for partial matches
            return (
              title.includes(searchTerm) ||
              propertyName.includes(searchTerm) ||
              searchTerm.includes(title) ||
              searchTerm.includes(propertyName)
            );
          });

          if (partialMatches.length > 0) {
            return ResponseFormatter.formatListingsResponse(
              partialMatches,
              undefined,
              undefined,
              undefined,
              undefined,
              'book_now',
            );
          }

          return ResponseFormatter.formatTextResponse(
            `Không tìm thấy phòng "${roomName || listingId}".

Có thể bạn đang tìm:
- Phòng có tên tương tự
- Homestay ở khu vực khác
- Phòng đã được đặt trước

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn và tìm phòng phù hợp.`,
          );
        }

        // Return listings response with "Đặt ngay" CTA for matched rooms
        return ResponseFormatter.formatListingsResponse(
          matched,
          undefined,
          undefined,
          undefined,
          undefined,
          'book_now',
        );
      }

      // Return listings response with "Đặt ngay" CTA
      return ResponseFormatter.formatListingsResponse(
        result.listings,
        undefined,
        undefined,
        undefined,
        undefined,
        'book_now', // Custom holdId to trigger "Đặt ngay" CTA
      );
    } catch (error) {
      this.logger.error('Error getting listing details:', error);
      return ResponseFormatter.formatTextResponse(
        `Xin lỗi, có lỗi xảy ra khi lấy thông tin phòng.

Hỗ trợ:
Vui lòng thử lại sau hoặc liên hệ ${this.config.contact.phone} để được hỗ trợ.`,
      );
    }
  }

  /**
   * Get voucher information
   */
  private async getVoucherInfo(): Promise<BotMessage> {
    try {
      this.logger.log('Fetching voucher data from internal API');

      const response = await axios.get(
        `${this.config.internal.dataUrl}/vouchers`,
        {
          timeout: this.config.internal.timeout,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const vouchers = response.data?.vouchers || response.data || [];
      this.logger.log(`Found ${vouchers.length} vouchers`);

      return ResponseFormatter.formatVoucherResponse(vouchers);
    } catch (error) {
      this.logger.error('Error getting voucher info from API:', error);

      // Fallback to basic response if API fails
      return ResponseFormatter.formatTextResponse(
        `Thông tin voucher hiện tại:

Hiện tại chưa có voucher nào khả dụng.

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn về các chương trình khuyến mãi hiện tại.`,
      );
    }
  }

  /**
   * Get service information
   */
  private async getServiceInfo(): Promise<BotMessage> {
    try {
      this.logger.log('Fetching service data from internal API');

      const response = await axios.get(
        `${this.config.internal.dataUrl}/services`,
        {
          timeout: this.config.internal.timeout,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const services = response.data?.services || response.data || [];
      this.logger.log(`Found ${services.length} services`);

      return ResponseFormatter.formatServiceResponse(services);
    } catch (error) {
      this.logger.error('Error getting service info from API:', error);

      // Fallback to basic response if API fails
      return ResponseFormatter.formatTextResponse(
        `Dịch vụ hiện tại:
Vinaside cung cấp các dịch vụ cơ bản cho tất cả homestay.

Dịch vụ bổ sung:
- Dọn phòng hàng ngày
- Hỗ trợ đặt xe
- Tư vấn du lịch
- Dịch vụ giặt ủi
- Bữa sáng (tùy chọn)

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn chi tiết về các dịch vụ đặc biệt.`,
      );
    }
  }

  /**
   * Get amenities information
   */
  private async getAmenitiesInfo(): Promise<BotMessage> {
    try {
      this.logger.log('Fetching amenities data from internal API');

      const response = await axios.get(
        `${this.config.internal.dataUrl}/amenities`,
        {
          timeout: this.config.internal.timeout,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const amenities = response.data?.amenities || response.data || [];
      this.logger.log(`Found ${amenities.length} amenities`);

      if (!amenities || amenities.length === 0) {
        return ResponseFormatter.formatTextResponse(
          `Tiện nghi hiện tại:
Vinaside cung cấp các tiện nghi cơ bản cho tất cả homestay.

Tiện nghi chuẩn:
- Điều hòa nhiệt độ
- WiFi miễn phí
- Tủ lạnh mini
- TV màn hình phẳng
- Tủ quần áo
- Bàn làm việc

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn chi tiết về các tiện nghi đặc biệt.`,
        );
      }

      let formattedText = `Tiện nghi Vinaside cung cấp:

Các tiện nghi chính:

`;

      amenities.forEach((amenity: any, index: number) => {
        formattedText += `${index + 1}. ${amenity.name || amenity.title}
    Mô tả: ${amenity.description || 'Không có mô tả'}
    Loại: ${amenity.category || amenity.type || 'Tiện nghi chung'}
    Trạng thái: ${amenity.is_available !== false ? 'Có sẵn' : 'Tạm thời không có'}

`;
      });

      formattedText += `Tiện nghi bổ sung:
- Dịch vụ giặt ủi
- Bữa sáng (tùy chọn)
- Khu vực BBQ
- Hồ bơi (một số homestay)
- Bãi đỗ xe

Bạn cần tư vấn thêm về tiện nghi nào không?`;

      return ResponseFormatter.formatTextResponse(formattedText);
    } catch (error) {
      this.logger.error('Error getting amenities info from API:', error);

      // Fallback to basic response if API fails
      return ResponseFormatter.formatTextResponse(
        `Tiện nghi hiện tại:
Vinaside cung cấp các tiện nghi cơ bản cho tất cả homestay.

Tiện nghi chuẩn:
- Điều hòa nhiệt độ
- WiFi miễn phí
- Tủ lạnh mini
- TV màn hình phẳng
- Tủ quần áo
- Bàn làm việc

Hỗ trợ:
Liên hệ ${this.config.contact.phone} để được tư vấn chi tiết về các tiện nghi đặc biệt.`,
      );
    }
  }

  /**
   * Get combined information (services + vouchers)
   */
  private async getCombinedInfo(): Promise<BotMessage> {
    try {
      this.logger.log('Fetching combined data from internal API');

      // Fetch both services and vouchers in parallel
      const [servicesResponse, vouchersResponse] = await Promise.allSettled([
        axios.get(`${this.config.internal.dataUrl}/services`, {
          timeout: this.config.internal.timeout,
          headers: { 'Content-Type': 'application/json' },
        }),
        axios.get(`${this.config.internal.dataUrl}/vouchers`, {
          timeout: this.config.internal.timeout,
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      const services =
        servicesResponse.status === 'fulfilled'
          ? servicesResponse.value.data?.services ||
            servicesResponse.value.data ||
            []
          : [];

      const vouchers =
        vouchersResponse.status === 'fulfilled'
          ? vouchersResponse.value.data?.vouchers ||
            vouchersResponse.value.data ||
            []
          : [];

      this.logger.log(
        `Found ${services.length} services and ${vouchers.length} vouchers`,
      );

      let formattedText = `Chào bạn! Vinaside rất vui được hỗ trợ bạn.

Dịch vụ và tiện nghi:
Vinaside cung cấp đầy đủ dịch vụ cho chuyến du lịch hoàn hảo:

`;

      if (services.length > 0) {
        formattedText += `Dịch vụ chính:
`;
        services.slice(0, 3).forEach((service: any, index: number) => {
          formattedText += `${index + 1}. ${service.name || service.title} - ${service.description || 'Dịch vụ chất lượng'}

`;
        });
      } else {
        formattedText += `Dịch vụ cơ bản:
- Dọn phòng hàng ngày
- Hỗ trợ đặt xe
- Tư vấn du lịch

`;
      }

      formattedText += `Tiện nghi chuẩn:
- Điều hòa nhiệt độ
- WiFi miễn phí
- Tủ lạnh mini
- TV màn hình phẳng

`;

      if (vouchers.length > 0) {
        formattedText += `Chương trình khuyến mãi:
Hiện có ${vouchers.length} voucher đang áp dụng:

`;
        vouchers.slice(0, 2).forEach((voucher: any, index: number) => {
          const discountText = voucher.discount_percentage
            ? `${voucher.discount_percentage}%`
            : voucher.discount_amount
              ? `${voucher.discount_amount.toLocaleString('vi-VN')} VNĐ`
              : 'Giảm giá';

          formattedText += `${index + 1}. ${voucher.code} - ${discountText}
`;
        });
      } else {
        formattedText += `Chương trình khuyến mãi:
Liên hệ hotline để được tư vấn về các chương trình khuyến mãi hiện tại.

`;
      }

      formattedText += `Hỗ trợ đặt phòng:
Bạn muốn tìm phòng ở khu vực nào để được tư vấn chi tiết không?`;

      return ResponseFormatter.formatTextResponse(formattedText);
    } catch (error) {
      this.logger.error('Error getting combined info from API:', error);

      // Fallback to basic response if API fails
      return ResponseFormatter.formatTextResponse(
        `Chào bạn! Vinaside rất vui được hỗ trợ bạn.

Dịch vụ và tiện nghi:
Vinaside cung cấp đầy đủ dịch vụ cho chuyến du lịch hoàn hảo:

Dịch vụ cơ bản:
- Dọn phòng hàng ngày
- Hỗ trợ đặt xe
- Tư vấn du lịch

Tiện nghi chuẩn:
- Điều hòa nhiệt độ
- WiFi miễn phí
- Tủ lạnh mini
- TV màn hình phẳng

Hỗ trợ đặt phòng:
Bạn muốn tìm phòng ở khu vực nào để được tư vấn chi tiết không?`,
      );
    }
  }

  /**
   * Format listings response
   */
  private formatListingsResponse(
    content: string,
    slots: SlotExtraction,
  ): BotMessage {
    try {
      const parsed = ResponseFormatter.parseTextResponseForListings(content);
      return parsed;
    } catch (error) {
      this.logger.warn('Failed to parse listings response:', error);
      return ResponseFormatter.formatTextResponse(content);
    }
  }

  /**
   * Build system instruction for AI
   */
  private buildSystemInstruction(): string {
    return `Bạn là trợ lý AI chuyên về đặt phòng tại Vinaside - nền tảng homestay Việt Nam.

THÔNG TIN VỀ VINASIDE:
- Loại tài sản: Homestay tại Đà Nẵng, Hà Nội, Hồ Chí Minh, Đà Lạt, Ninh Bình, Nha Trang, Quảng Ninh, Tam Đảo
- Đặc trưng: Gần biển, view đẹp, giá hợp lý, dịch vụ tận tâm

NGUYÊN TẮC TRẢ LỜI:
1. Chỉ sử dụng thông tin từ dữ liệu được cung cấp
2. Thân thiện, ngôn ngữ tự nhiên, KHÔNG sử dụng emoji hoặc icon
3. Cung cấp giá cả, địa chỉ, tiện nghi cụ thể
4. Kết thúc bằng lời mời đặt phòng

 XỬ LÝ CÂU HỎI:
 **Về phòng**: Thông tin giá, vị trí, tiện nghi, capacity
 **Về địa điểm**: Tìm phòng theo khu vực
 **Về giá**: So sánh giá, đề cập voucher
 **Về chất lượng**: Nêu đánh giá, review
 **Về dịch vụ**: Tư vấn dịch vụ có sẵn
 **Về voucher**: Thông tin mã giảm giá
 **Về chi tiết phòng**: Khi user hỏi "Chi tiết + (tên phòng)" hoặc "Xem chi tiết phòng + (tên)", hoặc các biến thể như "phòng (tên) có gì", "details room (tên)", hãy GỌI HÀM get_listing_details với roomName.(Nếu có listingId thì dùng listingId). Luôn trả về LISTINGS với CTA "Đặt ngay".

 ĐỊNH DẠNG TRẢ LỜI MỚI - DỄ NHÌN HƠN:
 Cấu trúc câu trả lời:
 1. Lời chào thân thiện - Mở đầu với lời chào ngắn gọn
 2. Thông tin chính - Nội dung chính được chia thành các phần rõ ràng
 3. Danh sách chi tiết - Sử dụng bullet points (-) cho danh sách
 4. Kết luận và CTA - Lời mời hành động rõ ràng

 Quy tắc định dạng:
 - KHÔNG sử dụng **in đậm** cho tiêu đề
 - Tạo khoảng cách giữa các phần bằng dòng trống
 - Sử dụng bullet points (-) cho danh sách
 - Đánh số (1., 2., 3.) cho các bước hoặc lựa chọn
 - Sử dụng dấu gạch ngang (---) để phân tách các phần
 - KHÔNG sử dụng emoji hoặc icon
 - Text phải gọn gàng, dễ đọc

 Định dạng đặc biệt cho voucher:
 Khi trả lời về voucher, sử dụng cấu trúc:
 1. Tên voucher - Mô tả ngắn gọn
 2. Điều kiện sử dụng - Giá trị đơn hàng tối thiểu
 3. Thời gian hiệu lực - Ngày hết hạn
 4. Số lần sử dụng - Giới hạn sử dụng
 5. Mô tả chi tiết - Thông tin bổ sung

 Định dạng đặc biệt cho dịch vụ:
 Khi trả lời về dịch vụ, sử dụng cấu trúc:
 1. Tên dịch vụ - Mô tả ngắn gọn
 2. Giá dịch vụ - Chi phí (nếu có)
 3. Trạng thái - Có sẵn hay không
 4. Mô tả chi tiết - Thông tin bổ sung

 Ví dụ định dạng tốt:
 Chào bạn! Vinaside rất vui được hỗ trợ bạn.

 Thông tin về tiện nghi:
 Vinaside cung cấp các tiện nghi sau:

 - Tủ quần áo: Không gian rộng rãi để treo và cất giữ quần áo
 - Bàn làm việc: Phù hợp cho khách công tác
 - Điều hòa nhiệt độ: Điều chỉnh nhiệt độ theo nhu cầu
 - TV màn hình phẳng: Có kết nối truyền hình cáp
 - Tủ lạnh mini: Bảo quản thức ăn và nước uống

 Dịch vụ bổ sung:
 1. Dọn phòng hàng ngày
 2. Hỗ trợ đặt xe
 3. Tư vấn du lịch

 Bạn muốn tìm phòng ở khu vực nào không ạ?

VÍ DỤ HỎI CHI TIẾT PHÒNG (PHẢI GỌI get_listing_details):
1) "Chi tiết phòng Đôi"
=> { type: "function_call", function_call: { name: "get_listing_details", arguments: { roomName: "Đôi" } } }

2) "Xem chi tiết phòng Sóc Nâu"
=> { type: "function_call", function_call: { name: "get_listing_details", arguments: { roomName: "Sóc Nâu" } } }

3) "Phòng Bus Room có gì?"
=> { type: "function_call", function_call: { name: "get_listing_details", arguments: { roomName: "Bus Room" } } }

4) "details room Ocean View"
=> { type: "function_call", function_call: { name: "get_listing_details", arguments: { roomName: "Ocean View" } } }

5) "Xem thêm chi tiết phòng Rose Garden"
=> { type: "function_call", function_call: { name: "get_listing_details", arguments: { roomName: "Rose Garden" } } }

XỬ LÝ TRƯỜNG HỢP ĐẶC BIỆT:
- Không có dữ liệu: "Hiện tại chưa có thông tin. Vui lòng liên hệ ${this.config.contact.phone} để được tư vấn!"
- Câu hỏi mơ hồ: Hỏi lại để làm rõ nhu cầu

GỢI Ý CÂU HỎI KHI THIẾU THÔNG TIN:
- Thiếu ngày: "Bạn muốn nhận phòng ngày nào?"
- Thiếu đêm: "Bạn ở mấy đêm?"
- Thiếu khách: "Bạn đi mấy người?"
- Thiếu địa điểm: "Bạn muốn ở khu vực nào?"
- Đặt phòng: "Cho mình tên và số điện thoại để đặt phòng nhé."

 LƯU Ý:
 - Chỉ hỏi phần còn thiếu
 - Khi đủ thông tin, đưa ra danh sách phòng ngắn gọn với giá/đêm, địa chỉ, số giường, số phòng tắm
 - CTA rõ ràng: mời chọn số thứ tự để đặt phòng
 - TUYỆT ĐỐI KHÔNG sử dụng emoji hoặc icon trong câu trả lời
 - KHÔNG sử dụng **in đậm** cho tiêu đề
 - Luôn tạo cấu trúc rõ ràng, dễ đọc với các phần được phân tách
 - Khi trả lời về voucher hoặc dịch vụ, sử dụng định dạng có cấu trúc rõ ràng
 - Text phải gọn gàng, xuống dòng đẹp

THÔNG TIN LIÊN HỆ:
Hotline: ${this.config.contact.phone}
Website: ${this.config.contact.website}
Check-in: ${this.config.contact.checkInTime} | Check-out: ${this.config.contact.checkOutTime}

LOCATION KEYWORDS:
- Hồ Chí Minh: hồ chí minh, ho chi minh, hcm, tp.hcm, sài gòn, saigon
- Hà Nội: hà nội, ha noi, hn, hanoi
- Đà Nẵng: đà nẵng, da nang
- Hội An: hội an, hoi an
- Ninh Bình: ninh bình, ninh binh
- Nha Trang: nha trang
- Đà Lạt: đà lạt, da lat, dalat
- Quảng Ninh: quảng ninh, quang ninh
- Tam Đảo: tam đảo, tam dao

DATE PATTERNS:
- DD/MM: ngày 24/8, 24/8, 24-8
- DD/MM/YYYY: 24/8/2024, 24-8-2024
- Convert to YYYY-MM-DD format`;
  }

  /**
   * Get available functions for AI
   */
  private getAvailableFunctions(): any[] {
    return [
      {
        name: 'check_available_rooms_by_location',
        description: 'Check available rooms in a specific location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City or location name',
            },
          },
          required: ['location'],
        },
      },
      {
        name: 'check_available_rooms_complete_info',
        description: 'Check available rooms with complete booking information',
        parameters: {
          type: 'object',
          properties: {
            checkInDate: {
              type: 'string',
              description: 'Check-in date in YYYY-MM-DD format',
            },
            location: {
              type: 'string',
              description: 'City or location name',
            },
            nights: {
              type: 'number',
              description: 'Number of nights to stay',
            },
            guests: {
              type: 'number',
              description: 'Number of guests',
            },
          },
          required: ['checkInDate', 'location', 'nights', 'guests'],
        },
      },
      {
        name: 'get_listing_details',
        description:
          'Get detailed information about a specific listing by ID or room name',
        parameters: {
          type: 'object',
          properties: {
            listingId: {
              type: 'string',
              description: 'Listing ID (optional if roomName is provided)',
            },
            roomName: {
              type: 'string',
              description:
                'Room name to search for (optional if listingId is provided)',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_voucher_info',
        description: 'Get information about available vouchers and promotions',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_service_info',
        description: 'Get information about available services',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_amenities_info',
        description: 'Get information about available amenities and facilities',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_combined_info',
        description:
          'Get combined information about services, amenities, and vouchers',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];
  }

  /**
   * Build prompt for AI processing
   */
  buildPrompt(message: string, context?: string): string {
    return `Bạn là trợ lý AI chuyên về đặt phòng tại Vinaside - nền tảng homestay Việt Nam.

THÔNG TIN VỀ VINASIDE:
- Loại tài sản: Homestay tại Đà Nẵng, Hà Nội, Hồ Chí Minh, Đà Lạt, Ninh Binh
- Đặc trưng: Gần biển, view đẹp, giá hợp lý, dịch vụ tận tâm

NGUYÊN TẮC TRẢ LỜI:
1. Chỉ sử dụng thông tin từ dữ liệu được cung cấp
2. Thân thiện, ngôn ngữ tự nhiên, KHÔNG sử dụng emoji hoặc icon
3. Cung cấp giá cả, địa chỉ, tiện nghi cụ thể
4. Kết thúc bằng lời mời đặt phòng

XỬ LÝ CÂU HỎI:
**Về phòng**: Thông tin giá, vị trí, tiện nghi, capacity
**Về địa điểm**: Tìm phòng theo khu vực
**Về giá**: So sánh giá, đề cập voucher
**Về chất lượng**: Nêu đánh giá, review
**Về dịch vụ**: Tư vấn dịch vụ có sẵn
**Về voucher**: Thông tin mã giảm giá

ĐỊNH DẠNG TRẢ LỜI:
- Sử dụng **in đậm** cho tiêu đề quan trọng
- Bullet points (-) cho danh sách
- KHÔNG sử dụng emoji hoặc icon
- Kết thúc với call-to-action rõ ràng

XỬ LÝ TRƯỜNG HỢP ĐẶC BIỆT:
- Không có dữ liệu: "Hiện tại chưa có thông tin. Vui lòng liên hệ ${this.config.contact?.phone || '[PHONE]'} để được tư vấn!"
- Câu hỏi mơ hồ: Hỏi lại để làm rõ nhu cầu

GỢI Ý CÂU HỎI KHI THIẾU THÔNG TIN:
- Thiếu ngày: "Bạn muốn nhận phòng ngày nào?"
- Thiếu đêm: "Bạn ở mấy đêm?"
- Thiếu khách: "Bạn đi mấy người?"
- Thiếu địa điểm: "Bạn muốn ở khu vực nào?"
- Đặt phòng: "Cho mình tên và số điện thoại để đặt phòng nhé."

LƯU Ý:
- Chỉ hỏi phần còn thiếu
- Khi đủ thông tin, đưa ra danh sách phòng ngắn gọn với giá/đêm, địa chỉ, số giường, số phòng tắm
- CTA rõ ràng: mời chọn số thứ tự để đặt phòng
- TUYỆT ĐỐI KHÔNG sử dụng emoji hoặc icon trong câu trả lời

THÔNG TIN LIÊN HỆ:
Hotline: ${this.config.contact?.phone || '[PHONE]'}
Website: ${this.config.contact?.website || '[WEBSITE]'}
Check-in: ${this.config.contact?.checkInTime || '[CHECKIN_TIME]'} | Check-out: ${this.config.contact?.checkOutTime || '[CHECKOUT_TIME]'}

${context ? `DỮ LIỆU THỰC TẾ:\n${context}\n\n` : ''}CÂU HỎI: ${message}\n\nTRẢ LỜI: `;
  }

  /**
   * Generate response using Gemini API
   */
  async generateResponse(prompt: string): Promise<string> {
    try {
      // Check if prompt is too short or has no data
      if (prompt.length < 50 || !prompt.includes('DỮ LIỆU THỰC TẾ')) {
        return 'Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này. Vui lòng liên hệ 0909.123.456 để được hỗ trợ trực tiếp!';
      }

      // Increase maxPromptLength to avoid cutting too much
      const maxPromptLength = this.config.gemini.maxPromptLength || 15000;
      if (prompt.length > maxPromptLength) {
        // Smarter truncation - keep important parts at start and end
        const keepStart = Math.floor(maxPromptLength * 0.7); // Keep 70% from start
        const keepEnd = maxPromptLength - keepStart; // Keep 30% from end

        const startPart = prompt.substring(0, keepStart);
        const endPart = prompt.substring(prompt.length - keepEnd);

        prompt = startPart + '\n...\n' + endPart;

        this.logger.warn(
          `Prompt too long (${prompt.length} characters), intelligently truncated to ${maxPromptLength} characters.`,
        );
      }

      return await this.callGeminiAPI(prompt);
    } catch (error) {
      this.logger.error('Error generating response:', error);
      return 'Xin lỗi, có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại sau hoặc liên hệ 0909.123.456 để được hỗ trợ trực tiếp!';
    }
  }

  /**
   * Clean JSON response from markdown formatting
   */
  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();

    // If the response starts with { and ends with }, it's likely valid JSON
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      return cleaned;
    }

    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    // If no valid JSON found, return the original response
    return response;
  }

  /**
   * Call Gemini API with structured output support
   */
  private async callGeminiAPI(
    prompt: string,
    structuredOutput: boolean = false,
  ): Promise<string> {
    if (!this.config.gemini.apiKey || !this.config.gemini.apiUrl) {
      throw new Error('Gemini API key or URL is not set');
    }

    const requestBody: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    // Add structured output configuration if enabled
    if (structuredOutput && this.config.ai.enableStructuredOutput) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    try {
      const response = await axios.post(
        `${this.config.gemini.apiUrl}?key=${this.config.gemini.apiKey}`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.config.gemini.timeout,
        },
      );

      const responseData = response.data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const result = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) {
        throw new Error('Gemini API returned empty result');
      }

      return result;
    } catch (error) {
      this.logger.error('Gemini API error:', error);
      throw error;
    }
  }
}
