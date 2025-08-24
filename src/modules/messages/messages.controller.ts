import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { SearchMessageDto } from './dto/search-message.dto';
import { AddReactionDto } from './dto/reaction.dto';
import {
  UserProfileResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Roles } from '../../decorators/roles.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { Message } from './schemas/message.schema';
import { ReactionType } from './schemas/message.schema';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Roles('guest', 'staff', 'admin')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Gửi tin nhắn mới hoặc reply tin nhắn',
    description:
      'Tạo tin nhắn mới. Có thể bao gồm reply_to_message_id để reply một tin nhắn cụ thể.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Tin nhắn được gửi thành công. Response bao gồm thông tin reply nếu có.',
  })
  create(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.create(createMessageDto, req.user);
  }

  @Get()
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn' })
  async findAll(
    @Query() query: QueryMessageDto,
    @Request() req: RequestWithUser,
  ): Promise<unknown[]> {
    try {
      const result = await this.messagesService.findAll(query, req.user);
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in findAll controller:', error);
      return [];
    }
  }

  @Get('conversations')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy danh sách cuộc trò chuyện',
    description:
      'Trả về danh sách cuộc trò chuyện bao gồm cả chat với properties và users. Mỗi cuộc trò chuyện có thông tin về tin nhắn cuối cùng, số tin nhắn chưa đọc, và người đang trả lời.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách cuộc trò chuyện với thông tin chi tiết',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'ID của property hoặc user' },
          type: {
            type: 'string',
            enum: ['property', 'user'],
            description: 'Loại cuộc trò chuyện',
          },
          name: { type: 'string', description: 'Tên property hoặc user' },
          avatar_url: { type: 'string', description: 'Ảnh đại diện' },
          status: { type: 'string', description: 'Trạng thái property' },
          isVerified: {
            type: 'boolean',
            description: 'Property đã được xác minh',
          },
          lastMessage: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Nội dung tin nhắn cuối',
              },
              sender_id: { type: 'string', description: 'ID người gửi' },
              is_read: { type: 'string', description: 'Trạng thái đọc' },
              sent_at: {
                type: 'string',
                format: 'date-time',
                description: 'Thời gian gửi',
              },
            },
          },
          messageCount: { type: 'number', description: 'Tổng số tin nhắn' },
          unreadCount: { type: 'number', description: 'Số tin nhắn chưa đọc' },
          firstMessageAt: {
            type: 'string',
            format: 'date-time',
            description: 'Thời gian tin nhắn đầu tiên',
          },
          lastMessageAt: {
            type: 'string',
            format: 'date-time',
            description: 'Thời gian tin nhắn cuối cùng',
          },
          lastSender: {
            type: 'object',
            properties: {
              _id: {
                type: 'string',
                description: 'ID người gửi tin nhắn cuối',
              },
              isCurrentUser: {
                type: 'boolean',
                description: 'Có phải người dùng hiện tại không',
              },
            },
          },
        },
      },
    },
  })
  async getConversations(
    @Request() req: RequestWithUser,
    @Query('ui_for') ui_for?: 'guest' | 'staff',
  ): Promise<unknown[]> {
    try {
      const result = await this.messagesService.getConversationsUI(
        req.user,
        ui_for,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (err: unknown) {
      console.error('Error in getConversations controller:', err);
      return [];
    }
  }

  @Get('conversation')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy tin nhắn trong cuộc trò chuyện với user cụ thể',
    description:
      'Trả về danh sách tin nhắn bao gồm thông tin reply và reactions với emoji. API này hỗ trợ realtime updates qua WebSocket và tự động sắp xếp tin nhắn theo thời gian (tin nhắn mới nhất ở cuối).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn trong cuộc trò chuyện với đầy đủ thông tin reply',
  })
  async getConversation(
    @Request() req: RequestWithUser,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('ui_for') ui_for?: 'guest' | 'staff',
  ): Promise<unknown[]> {
    if (!conversationId) {
      throw new BadRequestException('Thiếu tham số conversationId');
    }

    try {
      // For realtime conversation, we don't use pagination by default
      // to ensure all messages are available for realtime updates
      const queryParams: { limit?: number; page?: number } = {};

      // Only apply pagination if explicitly requested
      if (limit && !isNaN(Number(limit)) && Number(limit) > 0) {
        queryParams.limit = Number(limit);
        if (page && !isNaN(Number(page)) && Number(page) > 0) {
          queryParams.page = Number(page);
        }
      }
      // If no limit specified, get all messages for realtime support

      const result = await this.messagesService.getConversationMessages(
        req.user,
        conversationId,
        queryParams,
        ui_for,
      );

      // Emit realtime conversation update to all participants
      try {
        await this.messagesService.emitConversationUpdateToParticipants(
          conversationId,
          req.user._id,
          result,
        );
      } catch (emitError) {
        console.error('Failed to emit conversation update:', emitError);
        // Don't fail the request if WebSocket emission fails
      }

      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (err: unknown) {
      console.error('Error in getConversation controller:', err);
      return [];
    }
  }

  @Get('conversation/:userId')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy tin nhắn trong cuộc trò chuyện với user cụ thể (deprecated)',
  })
  @ApiOperation({ summary: 'Deprecated - dùng messages?conversationId=...' })
  @ApiResponse({ status: 200, description: 'Tin nhắn trong cuộc trò chuyện' })
  async getConversationDeprecated(
    @Param('userId') userId: string,
    @Query() query: QueryMessageDto,
    @Request() req: RequestWithUser,
  ): Promise<unknown[]> {
    try {
      const result = await this.messagesService.getConversation(
        req.user._id,
        userId,
        query,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (err: unknown) {
      console.error('Error in getConversationDeprecated controller:', err);
      return [];
    }
  }

  @Get('websocket-status')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Kiểm tra trạng thái WebSocket connection' })
  @ApiResponse({ status: 200, description: 'Trạng thái WebSocket' })
  getWebSocketStatus(@Request() req: RequestWithUser) {
    return this.messagesService.getWebSocketStatus();
  }

  @Get('unread-count')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy số tin nhắn chưa đọc' })
  @ApiResponse({ status: 200, description: 'Số tin nhắn chưa đọc' })
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.messagesService.getUnreadCount(req.user._id);
  }

  @Get('all-users')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy danh sách tất cả người dùng để nhắn tin (deprecated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người dùng',
    type: [UserResponseDto],
  })
  async getAllUsers(
    @Request() req: RequestWithUser,
  ): Promise<UserResponseDto[]> {
    try {
      const result = await this.messagesService.getAllUsers(req.user._id);
      return Array.isArray(result) ? (result as UserResponseDto[]) : [];
    } catch (error) {
      console.error('Error in getAllUsers controller:', error);
      return [];
    }
  }

  @Get('available-properties')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách properties có thể chat' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách properties có lịch sử chat',
    type: [UserResponseDto],
  })
  async getAvailableUsers(
    @Request() req: RequestWithUser,
  ): Promise<UserResponseDto[]> {
    try {
      const result = await this.messagesService.getAvailableProperties(
        req.user._id,
      );
      return Array.isArray(result) ? (result as UserResponseDto[]) : [];
    } catch (error) {
      console.error('Error in getAvailableUsers controller:', error);
      return [];
    }
  }

  @Get('user/:userId')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy thông tin profile của người dùng' })
  @ApiParam({ name: 'userId', description: 'ID của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin người dùng',
    type: UserProfileResponseDto,
  })
  async getUserProfile(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ): Promise<UserProfileResponseDto> {
    try {
      const result = await this.messagesService.getUserProfile(
        userId,
        req.user._id,
      );
      return (
        (result as UserProfileResponseDto) || ({} as UserProfileResponseDto)
      );
    } catch (error) {
      console.error('Error in getUserProfile controller:', error);
      return {} as UserProfileResponseDto;
    }
  }

  // ==================== REACTION ENDPOINTS ====================

  @Post(':id/reactions')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Thêm reaction vào tin nhắn' })
  @ApiResponse({ status: 201, description: 'Reaction được thêm thành công' })
  addReaction(
    @Param('id') id: string,
    @Body() addReactionDto: AddReactionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.addReaction(id, addReactionDto, req.user);
  }

  @Delete(':id/reactions/:type')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Xóa reaction cho tin nhắn' })
  @ApiParam({
    name: 'id',
    description: 'ID của tin nhắn',
    type: 'string',
  })
  @ApiParam({
    name: 'type',
    description: 'Loại reaction',
    enum: ReactionType,
    example: 'like',
  })
  @ApiResponse({ status: 200, description: 'Reaction được xóa thành công' })
  removeReaction(
    @Param('id') id: string,
    @Param('type') type: string,
    @Request() req: RequestWithUser,
  ) {
    // Validate reaction type
    const validTypes = Object.values(ReactionType);
    if (!validTypes.includes(type as ReactionType)) {
      throw new BadRequestException(
        `Loại reaction không hợp lệ. Chỉ hỗ trợ: ${validTypes.join(', ')}`,
      );
    }

    return this.messagesService.removeReaction(id, req.user);
  }

  @Post(':id/reactions/toggle/:type')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Toggle reaction cho tin nhắn (thêm/xóa)' })
  @ApiParam({
    name: 'id',
    description: 'ID của tin nhắn',
    type: 'string',
  })
  @ApiParam({
    name: 'type',
    description: 'Loại reaction',
    enum: ReactionType,
    example: 'like',
  })
  @ApiResponse({ status: 200, description: 'Toggle reaction thành công' })
  toggleReaction(
    @Param('id') id: string,
    @Param('type') type: string,
    @Request() req: RequestWithUser,
  ) {
    // Validate reaction type
    const validTypes = Object.values(ReactionType);
    if (!validTypes.includes(type as ReactionType)) {
      throw new BadRequestException(
        `Loại reaction không hợp lệ. Chỉ hỗ trợ: ${validTypes.join(', ')}`,
      );
    }

    return this.messagesService.toggleReaction(
      id,
      type as ReactionType,
      req.user,
    );
  }

  @Post(':id/recall')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Thu hồi tin nhắn đã gửi' })
  @ApiResponse({ status: 200, description: 'Thu hồi tin nhắn thành công' })
  recallMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.recallMessage(id, req.user);
  }

  @Post('search')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Tìm kiếm tin nhắn theo nội dung' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm tin nhắn' })
  async search(
    @Body() searchMessageDto: SearchMessageDto,
    @Request() req: RequestWithUser,
  ): Promise<unknown[]> {
    try {
      const result = await this.messagesService.search(
        searchMessageDto,
        req.user,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in search controller:', error);
      return [];
    }
  }

  @Patch('conversation/read')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Đánh dấu toàn bộ cuộc hội thoại đã đọc' })
  @ApiResponse({
    status: 200,
    description: 'Cuộc hội thoại được đánh dấu đã đọc',
  })
  markConversationAsRead(
    @Query('conversationId') conversationId: string,
    @Request() req: RequestWithUser,
  ) {
    if (!conversationId) {
      throw new BadRequestException('Thiếu tham số conversationId');
    }
    return this.messagesService.markConversationRead(req.user, conversationId);
  }

  // ==================== DYNAMIC ROUTES (MUST BE LAST) ====================

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tin nhắn' })
  @ApiResponse({ status: 200, description: 'Thông tin tin nhắn' })
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<unknown> {
    try {
      const result = await this.messagesService.findOne(id, req.user);
      return result;
    } catch (error) {
      console.error('Error in findOne controller:', error);
      throw new NotFoundException('Tin nhắn không tìm thấy');
    }
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Cập nhật nội dung tin nhắn' })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn được cập nhật thành công',
  })
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req: RequestWithUser,
  ): Promise<Message | null> {
    try {
      const result = await this.messagesService.update(
        id,
        updateMessageDto,
        req.user,
      );
      return result;
    } catch (error) {
      console.error('Error in update controller:', error);
      throw new NotFoundException('Tin nhắn không tìm thấy');
    }
  }

  @Patch(':id/read')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Đánh dấu tin nhắn đã đọc' })
  @ApiResponse({ status: 200, description: 'Tin nhắn được đánh dấu đã đọc' })
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.markAsRead(id, req.user._id);
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<Message | null> {
    try {
      const result = await this.messagesService.remove(id, req.user);
      return result;
    } catch (error) {
      console.error('Error in remove controller:', error);
      throw new NotFoundException('Tin nhắn không tìm thấy');
    }
  }
}
