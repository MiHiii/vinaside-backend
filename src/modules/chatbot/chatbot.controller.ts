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
import { ChatbotService } from './chatbot.service';
import { CreateChatbotMessageDto } from './types/chatbot-message.dto';
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

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

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
    return this.chatbotService.handleMessage(createChatbotMessageDto, req.user);
  }

  @Get('conversations')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách cuộc trò chuyện với chatbot' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách cuộc trò chuyện với chatbot',
  })
  @ResponseMessage('Lấy danh sách cuộc trò chuyện thành công')
  async getConversations(@Request() req: RequestWithUser): Promise<unknown[]> {
    try {
      const result = await this.chatbotService.getConversations(req.user._id);
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getConversations controller:', error);
      return [];
    }
  }

  @Get('conversation')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy tin nhắn trong cuộc trò chuyện với chatbot',
    description: 'Trả về danh sách tin nhắn trong cuộc trò chuyện với chatbot.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn trong cuộc trò chuyện với chatbot',
  })
  @ResponseMessage('Lấy tin nhắn trong cuộc trò chuyện thành công')
  async getConversation(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<unknown[]> {
    try {
      const queryParams: { limit?: number; page?: number } = {};
      if (limit && !isNaN(Number(limit))) {
        queryParams.limit = Number(limit);
      }
      if (page && !isNaN(Number(page))) {
        queryParams.page = Number(page);
      }

      const result = await this.chatbotService.getConversation(
        req.user._id,
        queryParams,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getConversation controller:', error);
      return [];
    }
  }

  @Get('history')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy lịch sử chat với chatbot' })
  @ApiResponse({ status: 200, description: 'Lịch sử chat với chatbot' })
  @ResponseMessage('Lấy lịch sử chat thành công')
  async getChatHistory(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<unknown[]> {
    try {
      const queryParams: { limit?: number; page?: number } = {};
      if (limit && !isNaN(Number(limit))) {
        queryParams.limit = Number(limit);
      }
      if (page && !isNaN(Number(page))) {
        queryParams.page = Number(page);
      }

      const result = await this.chatbotService.getConversation(
        req.user._id,
        queryParams,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getChatHistory controller:', error);
      return [];
    }
  }

  @Post('search')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Tìm kiếm tin nhắn trong chat với chatbot' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm tin nhắn' })
  @ResponseMessage('Tìm kiếm tin nhắn thành công')
  async search(
    @Body() searchDto: { query: string },
    @Request() req: RequestWithUser,
  ): Promise<unknown[]> {
    try {
      const result = await this.chatbotService.search(
        searchDto.query,
        req.user,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in search controller:', error);
      return [];
    }
  }

  @Delete('conversation')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa toàn bộ cuộc trò chuyện với chatbot' })
  @ApiResponse({
    status: 204,
    description: 'Cuộc trò chuyện được xóa thành công',
  })
  @ResponseMessage('Xóa cuộc trò chuyện thành công')
  clearConversation(@Request() req: RequestWithUser) {
    return this.chatbotService.clearConversation(req.user._id);
  }

  @Get('stats')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy thống kê chat với chatbot' })
  @ApiResponse({ status: 200, description: 'Thống kê chat với chatbot' })
  @ResponseMessage('Lấy thống kê chat thành công')
  getChatStats(@Request() req: RequestWithUser) {
    return this.chatbotService.getChatStats(req.user._id);
  }

  @Post('feedback')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Gửi feedback cho chatbot' })
  @ApiResponse({ status: 201, description: 'Feedback được gửi thành công' })
  @ResponseMessage('Gửi feedback thành công')
  sendFeedback() {
    return this.chatbotService.sendFeedback();
  }

  @Get(':id')
  @RequirePermission('chatbot.view')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tin nhắn chatbot' })
  @ApiResponse({ status: 200, description: 'Thông tin tin nhắn chatbot' })
  @ResponseMessage('Lấy thông tin tin nhắn thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.chatbotService.findOne(id, req.user);
  }

  @Delete(':id')
  @RequirePermission('chatbot.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa tin nhắn chatbot' })
  @ApiResponse({ status: 204, description: 'Tin nhắn được xóa thành công' })
  @ResponseMessage('Xóa tin nhắn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.chatbotService.remove(id, req.user);
  }
}
