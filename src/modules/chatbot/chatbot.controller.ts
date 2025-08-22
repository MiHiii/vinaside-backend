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

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Chatbot')
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ChatbotController {
  constructor(private readonly aiChatbotService: AIChatbotService) {}

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
    // Service đã trả về BotMessage trực tiếp
    return this.aiChatbotService.processMessage(
      createChatbotMessageDto.content,
    );
  }
}
