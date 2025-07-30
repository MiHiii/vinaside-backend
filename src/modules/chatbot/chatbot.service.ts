import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { PromptBuilder } from './prompt-builder';
import { CreateChatbotMessageDto } from './types/chatbot-message.dto';
import { ChatbotMessage } from './schemas/chatbot-message.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@Injectable()
export class ChatbotService {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiUrl = process.env.GEMINI_API_URL;

  constructor(
    @InjectModel(ChatbotMessage.name)
    private chatbotMessageModel: Model<ChatbotMessage>,
  ) {}

  async handleMessage(
    dto: CreateChatbotMessageDto,
    user: JwtPayload,
  ): Promise<{ reply: string }> {
    // Chỉ lấy các trường cần thiết và đúng tên thực tế của listings (title, price_per_night, description)
    let context = '';
    try {
      const { data } = await axios.get(
        'http://localhost:8080/api/v1/internal-data',
      );
      if (data && data.listings) {
        const listings = data.listings.map((item: any) => ({
          title: item.title,
          price_per_night: item.price_per_night,
          description: item.description,
        }));
        context = JSON.stringify({ listings });
      }
    } catch (e) {
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
    const { limit = 20, page = 1 } = queryParams;
    const skip = (page - 1) * limit;

    return this.chatbotMessageModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getChatHistory(
    userId: string,
    queryParams: { limit?: number; page?: number },
  ) {
    const { limit = 50, page = 1 } = queryParams;
    const skip = (page - 1) * limit;

    return this.chatbotMessageModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async search(query: string, user: JwtPayload) {
    return this.chatbotMessageModel
      .find({
        user_id: user._id,
        $or: [
          { content: { $regex: query, $options: 'i' } },
          { reply: { $regex: query, $options: 'i' } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();
  }

  async clearConversation(userId: string) {
    return this.chatbotMessageModel.deleteMany({ user_id: userId });
  }

  async getChatStats(userId: string) {
    const totalMessages = await this.chatbotMessageModel.countDocuments({
      user_id: userId,
    });
    const todayMessages = await this.chatbotMessageModel.countDocuments({
      user_id: userId,
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
    });

    return {
      totalMessages,
      todayMessages,
      averageResponseTime: '2.5s', // Placeholder
    };
  }

  async sendFeedback(
    feedbackDto: { message_id: string; rating: number; comment?: string },
    user: JwtPayload,
  ) {
    // Implement feedback logic here
    return { success: true, message: 'Feedback sent successfully' };
  }

  async findOne(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOne({ _id: id, user_id: user._id });
  }

  async remove(id: string, user: JwtPayload) {
    return this.chatbotMessageModel.findOneAndDelete({
      _id: id,
      user_id: user._id,
    });
  }
}
