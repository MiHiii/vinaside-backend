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
      const guide =
        'Bạn là trợ lý AI thông minh chuyên về du lịch và đặt phòng tại Vinaside. Trả lời ngắn gọn, chính xác, thân thiện và hữu ích. Chỉ sử dụng thông tin từ dữ liệu được cung cấp. Nếu không có thông tin phù hợp, hãy gợi ý các tùy chọn khác hoặc yêu cầu thông tin thêm. Sử dụng emoji phù hợp để làm cho câu trả lời sinh động. Luôn cố gắng tìm thông tin liên quan, ngay cả khi câu hỏi không hoàn toàn khớp.';
      return await this.askGemini(`${guide}\n${prompt}`);
    } catch (error) {
      this.logger.error('Error generating response:', error);
      return 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. Hãy thử lại sau nhé!';
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
      throw new Error('Gemini API key or URL is not set');
    }
    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );

      const responseData = response.data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      return (
        responseData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Không có phản hồi từ Gemini API'
      );
    } catch (error) {
      this.logger.error('Gemini API error:', error);
      throw new Error('Gemini API request failed');
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
