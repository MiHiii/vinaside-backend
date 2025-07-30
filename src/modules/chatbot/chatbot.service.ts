import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { PromptBuilder } from './prompt-builder';
import { CreateChatbotMessageDto } from './types/chatbot-message.dto';
import { ChatbotMessage } from './schemas/chatbot-message.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface InternalDataResponse {
  data: {
    listings: Array<{
      title: string;
      price_per_night: number;
      description: string;
    }>;
  };
}

@Injectable()
export class ChatbotService {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiUrl = process.env.GEMINI_API_URL;

  constructor(
    @InjectModel(ChatbotMessage.name)
    private chatbotMessageModel: Model<ChatbotMessage>,
  ) {}

  // Add missing methods for gateway
  analyzeIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('giá rẻ') ||
      lowerMessage.includes('rẻ nhất') ||
      lowerMessage.includes('cheapest')
    ) {
      return 'ask_cheapest_room';
    }

    if (
      lowerMessage.includes('chào') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi')
    ) {
      return 'greeting';
    }

    if (
      lowerMessage.includes('tạm biệt') ||
      lowerMessage.includes('goodbye') ||
      lowerMessage.includes('bye')
    ) {
      return 'goodbye';
    }

    if (
      lowerMessage.includes('voucher') ||
      lowerMessage.includes('khuyến mãi')
    ) {
      return 'ask_voucher';
    }

    return 'general_inquiry';
  }

  async generateResponse(
    message: string,
    context: string,
    intent: string,
  ): Promise<string> {
    try {
      const guide =
        'Chỉ trả lời dựa trên danh sách phòng dưới đây. Không bịa thêm thông tin. Nếu không có thông tin phù hợp, trả lời: "Không có dữ liệu".';
      const prompt = PromptBuilder.buildPrompt(
        message,
        `${guide}\nDanh sách phòng:\n${context}`,
      );

      return await this.askGemini(prompt);
    } catch (error) {
      Logger.error('Error generating response:', error);
      return 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn.';
    }
  }

  async handleMessage(
    dto: CreateChatbotMessageDto,
    user: JwtPayload,
  ): Promise<{ reply: string }> {
    // Chỉ lấy các trường cần thiết và đúng tên thực tế của listings (title, price_per_night, description)
    let context = '';
    try {
      const { data } = await axios.get<InternalDataResponse>(
        'http://localhost:8080/api/v1/internal-data',
      );
      if (data && data.listings) {
        const listings = data.listings.map((item) => ({
          title: item.title,
          price_per_night: item.price_per_night,
          description: item.description,
        }));
        context = JSON.stringify({ listings });
      }
    } catch {
      context = '';
    }

    // Hướng dẫn cứng rắn cho AI: chỉ trả lời dựa trên dữ liệu JSON, không bịa thêm
    const guide =
      'Chỉ trả lời dựa trên dữ liệu JSON bên dưới, tuyệt đối không bịa thêm thông tin ngoài dữ liệu này. Nếu không tìm thấy thông tin, hãy trả lời "Không có dữ liệu". Dưới đây là danh sách phòng (listings), mỗi phòng có các trường: "title" (tên phòng), "price_per_night" (giá tiền mỗi đêm), "description" (mô tả).';
    const prompt = PromptBuilder.buildPrompt(
      dto.content,
      context ? guide + '\nDữ liệu: ' + context : undefined,
    );
    const reply = await this.askGemini(prompt);

    // Lưu tin nhắn vào database
    await this.chatbotMessageModel.create({
      content: dto.content,
      user_id: user._id,
      reply: reply,
    });

    return { reply };
  }

  async askGemini(prompt: string): Promise<string> {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error(
        'Gemini API key or URL is not set in environment variables',
      );
    }
    try {
      const url = `${this.apiUrl}?key=${this.apiKey}`;
      const response = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      // Gemini API trả về reply ở response.data.candidates[0].content.parts[0].text
      if (
        response.data &&
        response.data.candidates &&
        response.data.candidates[0]?.content?.parts[0]?.text
      ) {
        return response.data.candidates[0].content.parts[0].text;
      }
      throw new Error('No reply from Gemini API');
    } catch (error) {
      Logger.error('Gemini API error:', error);
      throw new Error('Gemini API request failed');
    }
  }

  async getConversations(userId: string) {
    return this.chatbotMessageModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

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

  async getChatHistory(
    userId: string,
    queryParams: { limit?: number; page?: number },
  ) {
    const limit = queryParams.limit || 20;
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

  async clearConversation(userId: string) {
    return this.chatbotMessageModel.deleteMany({ user_id: userId });
  }

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

    return {
      totalMessages,
      userMessages,
      botMessages,
    };
  }

  async sendFeedback(
    feedbackDto: { message_id: string; rating: number; comment?: string },
    user: JwtPayload,
  ) {
    // Implementation for feedback
    return { success: true, message: 'Feedback sent successfully' };
  }

  async findOne(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOne({
      _id: id,
      user_id: user._id,
    });
  }

  async remove(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOneAndDelete({
      _id: id,
      user_id: user._id,
    });
  }
}
