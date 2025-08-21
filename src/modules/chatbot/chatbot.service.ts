import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { ChatbotMessage } from './schemas/chatbot-message.schema';
import { CreateChatbotMessageDto } from './types/chatbot-message.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { PromptBuilder } from './prompt-builder';

interface InternalDataResponse {
  data: {
    listings: Array<{
      _id: string;
      title: string;
      price_per_night: number;
      description: string;
      images?: string[];
      status: string;
      voucher_ids?: string[];
      view_type?: 'sea' | 'city' | 'garden';
      pet_friendly?: boolean;
      family_friendly?: boolean;
      cancellation_policy?: string;
    }>;
    bookings: Array<{
      listingId: string;
      checkInDate: string;
      check_out_date: string;
      status: string;
    }>;
    vouchers: Array<{
      _id: string;
      code: string;
      discount_percent: number;
      expiration_date: string;
      is_active: boolean;
      min_order_value: number;
      min_nights?: number;
      event_name?: string;
    }>;
    services: Array<{
      _id: string;
      name: string;
      default_price: number;
      description?: string;
    }>;
    reviews: Array<{
      room_id: string;
      rating: number;
      comment: string;
    }>;
  };
}

@Injectable()
export class ChatbotService {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiUrl = process.env.GEMINI_API_URL;
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectModel(ChatbotMessage.name)
    private chatbotMessageModel: Model<ChatbotMessage>,
  ) {}

  // Xây dựng prompt để gửi tới Gemini API
  buildPrompt(message: string, context?: string): string {
    return PromptBuilder.buildPrompt(message, context);
  }

  // Gửi yêu cầu tới Gemini API và nhận phản hồi
  async generateResponse(prompt: string): Promise<string> {
    try {
      // Kiểm tra nếu prompt quá ngắn hoặc không có dữ liệu
      if (prompt.length < 50 || !prompt.includes('DỮ LIỆU THỰC TẾ')) {
        this.logger.warn(
          `Prompt không đủ thông tin: ${prompt.substring(0, 100)}...`,
        );
        return 'Hiện tại chưa có đủ thông tin để trả lời. Bạn có thể hỏi về phòng hoặc dịch vụ cụ thể không?';
      }

      const response = await this.askGemini(prompt);

      // Kiểm tra và xử lý phản hồi
      if (!response || response.trim().length === 0) {
        return 'Xin lỗi, tôi không tìm được thông tin phù hợp. Hãy thử hỏi về phòng hoặc dịch vụ có trong hệ thống.';
      }

      return response;
    } catch (error) {
      this.logger.error('Error generating response:', error);
      // Cung cấp phản hồi thân thiện khi có lỗi
      return 'Xin lỗi, hiện tại tôi đang gặp vấn đề kỹ thuật. Hãy liên hệ 0909.123.456 để được hỗ trợ trực tiếp!';
    }
  }

  // Xử lý tin nhắn từ người dùng
  async handleMessage(
    dto: CreateChatbotMessageDto,
    user: JwtPayload,
  ): Promise<{ reply: string }> {
    let context = '';
    try {
      const response = await axios.get<InternalDataResponse>(
        'http://localhost:8080/api/v1/internal-data',
      );
      context = JSON.stringify(response.data);
    } catch {
      this.logger.warn('Failed to fetch internal data');
    }

    const prompt = this.buildPrompt(
      dto.content,
      context ? `Dữ liệu: ${context}` : 'Không có dữ liệu sẵn có.',
    );
    const reply = await this.generateResponse(prompt);

    await this.chatbotMessageModel.create({
      content: dto.content,
      user_id: user._id,
      reply,
    });

    return { reply };
  }

  // Gọi Gemini API
  async askGemini(prompt: string): Promise<string> {
    if (!this.apiKey || !this.apiUrl) {
      this.logger.error('Gemini API key or URL is not set');
      return 'Xin lỗi, hệ thống chưa được cấu hình đúng. Vui lòng liên hệ 0909.123.456 để được hỗ trợ.';
    }

    // Đảm bảo prompt không quá lớn
    const maxPromptLength = 8000;
    if (prompt.length > maxPromptLength) {
      prompt = prompt.substring(0, maxPromptLength) + '...';
      this.logger.warn(
        `Prompt quá dài (${prompt.length} ký tự), đã cắt ngắn xuống ${maxPromptLength} ký tự.`,
      );
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000, // Tăng timeout lên 15s
        },
      );

      const responseData = response.data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const result = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) {
        this.logger.warn('Gemini API trả về kết quả rỗng');
        return 'Xin lỗi, tôi không tìm thấy thông tin phù hợp. Hãy thử hỏi về phòng hoặc dịch vụ có trong hệ thống.';
      }

      return result;
    } catch (error) {
      // Log chi tiết lỗi để debug
      const err = error as {
        response?: { status: string; data: any };
        request?: any;
        message?: string;
      };

      if (err.response) {
        this.logger.error(
          `Gemini API error (${err.response.status}):`,
          err.response.data,
        );
      } else if (err.request) {
        this.logger.error('Gemini API no response:', err.message);
      } else {
        this.logger.error('Gemini API error:', err.message);
      }

      // Trả về thông báo thân thiện hơn
      return 'Xin lỗi, tôi đang gặp vấn đề kết nối. Vui lòng hỏi lại sau hoặc liên hệ 0909.123.456 để được hỗ trợ trực tiếp!';
    }
  }

  // Lấy danh sách cuộc trò chuyện gần đây
  async getConversations(userId: string) {
    return this.chatbotMessageModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

  // Lấy lịch sử trò chuyện với phân trang
  async getConversation(
    userId: string,
    queryParams: { limit?: number; page?: number },
  ) {
    const limit = queryParams.limit || 10;
    const page = queryParams.page || 1;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.chatbotMessageModel
        .find({ user_id: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.chatbotMessageModel.countDocuments({ user_id: userId }),
    ]);

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Lấy thống kê trò chuyện
  async getChatStats(userId: string) {
    const [totalMessages, userMessages, botMessages] = await Promise.all([
      this.chatbotMessageModel.countDocuments({ user_id: userId }),
      this.chatbotMessageModel.countDocuments({
        user_id: userId,
        content: { $exists: true },
      }),
      this.chatbotMessageModel.countDocuments({
        user_id: userId,
        reply: { $exists: true },
      }),
    ]);

    return { totalMessages, userMessages, botMessages };
  }

  // Gửi phản hồi
  sendFeedback() {
    return { success: true, message: 'Feedback sent successfully' };
  }

  // Tìm một tin nhắn cụ thể
  async findOne(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOne({ _id: id, user_id: user._id });
  }

  // Xóa một tin nhắn
  async remove(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOneAndDelete({
      _id: id,
      user_id: user._id,
    });
  }

  // Xóa toàn bộ cuộc trò chuyện
  async clearConversation(userId: string) {
    return this.chatbotMessageModel.deleteMany({ user_id: userId });
  }

  // Tìm kiếm tin nhắn
  async search(query: string, user: JwtPayload) {
    const searchRegex = new RegExp(query, 'i');
    return this.chatbotMessageModel
      .find({
        user_id: user._id,
        $or: [{ content: searchRegex }, { reply: searchRegex }],
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }
}
