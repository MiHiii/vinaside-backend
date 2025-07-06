import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AddReactionDto } from './dto/reaction.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { SearchMessageDto } from './dto/search-message.dto';
import { ReactionType } from './schemas/message.schema';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../decorators/roles.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Gửi tin nhắn mới' })
  @ApiResponse({ status: 201, description: 'Tin nhắn được gửi thành công' })
  @ResponseMessage('Gửi tin nhắn thành công')
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
  @ResponseMessage('Lấy danh sách tin nhắn thành công')
  async findAll(
    @Query() query: QueryMessageDto,
    @Request() req: RequestWithUser,
  ) {
    try {
      const result = await this.messagesService.findAll(query, req.user);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in findAll controller:', error);
      return [];
    }
  }

  @Get('conversations')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách cuộc trò chuyện' })
  @ResponseMessage('Lấy danh sách cuộc trò chuyện thành công')
  async getConversations(@Request() req: RequestWithUser): Promise<unknown[]> {
    try {
      const result = await this.messagesService.getConversations(req.user._id);
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getConversations controller:', error);
      return [];
    }
  }

  @Get('conversation')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy tin nhắn trong cuộc trò chuyện với user cụ thể',
  })
  @ApiResponse({ status: 200, description: 'Tin nhắn trong cuộc trò chuyện' })
  @ResponseMessage('Lấy tin nhắn trong cuộc trò chuyện thành công')
  async getConversation(
    @Request() req: RequestWithUser,
    @Query('otherUserId') otherUserId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<unknown[]> {
    // Validate otherUserId exists
    if (!otherUserId) {
      throw new BadRequestException('Thiếu tham số otherUserId');
    }

    try {
      // Parse query parameters manually để tránh default values
      const queryParams: { limit?: number; page?: number } = {};
      if (limit && !isNaN(Number(limit))) {
        queryParams.limit = Number(limit);
      }
      if (page && !isNaN(Number(page))) {
        queryParams.page = Number(page);
      }

      const result = await this.messagesService.getConversation(
        req.user._id,
        otherUserId,
        queryParams,
      );
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getConversation controller:', error);
      return [];
    }
  }

  @Get('conversation/:userId')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy tin nhắn trong cuộc trò chuyện với user cụ thể (deprecated)',
  })
  @ApiResponse({ status: 200, description: 'Tin nhắn trong cuộc trò chuyện' })
  @ResponseMessage('Lấy tin nhắn trong cuộc trò chuyện thành công')
  getConversationDeprecated(
    @Param('userId') userId: string,
    @Query() query: QueryMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.getConversation(req.user._id, userId, query);
  }

  @Get('unread-count')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy số tin nhắn chưa đọc' })
  @ApiResponse({ status: 200, description: 'Số tin nhắn chưa đọc' })
  @ResponseMessage('Lấy số tin nhắn chưa đọc thành công')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.messagesService.getUnreadCount(req.user._id);
  }

  @Get('all-users')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách tất cả người dùng để nhắn tin' })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng' })
  @ResponseMessage('Lấy danh sách tất cả người dùng thành công')
  async getAllUsers(@Request() req: RequestWithUser): Promise<unknown[]> {
    try {
      const result = await this.messagesService.getAllUsers(req.user._id);
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getAllUsers controller:', error);
      return [];
    }
  }

  @Get('available-users')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách người dùng đã từng chat' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người dùng có lịch sử chat',
  })
  @ResponseMessage('Lấy danh sách người dùng có lịch sử chat thành công')
  async getAvailableUsers(@Request() req: RequestWithUser): Promise<unknown[]> {
    try {
      const result = await this.messagesService.getAvailableUsers(req.user._id);
      return Array.isArray(result) ? (result as unknown[]) : [];
    } catch (error) {
      console.error('Error in getAvailableUsers controller:', error);
      return [];
    }
  }

  // ==================== REACTION ENDPOINTS ====================

  @Post(':id/reactions')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Thêm reaction vào tin nhắn' })
  @ApiResponse({ status: 201, description: 'Reaction được thêm thành công' })
  @ResponseMessage('Thêm reaction thành công')
  addReaction(
    @Param('id') id: string,
    @Body() addReactionDto: AddReactionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.addReaction(id, addReactionDto, req.user);
  }

  @Delete(':id/reactions')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Xóa reaction khỏi tin nhắn' })
  @ApiResponse({ status: 200, description: 'Reaction được xóa thành công' })
  @ResponseMessage('Xóa reaction thành công')
  removeReaction(@Param('id') id: string, @Request() req: RequestWithUser) {
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
  @ResponseMessage('Toggle reaction thành công')
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

  @Patch(':id/pin')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Ghim tin nhắn quan trọng' })
  @ApiResponse({ status: 200, description: 'Tin nhắn được ghim thành công' })
  @ResponseMessage('Ghim tin nhắn thành công')
  pinMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.pinMessage(id, req.user);
  }

  @Patch(':id/unpin')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Bỏ ghim tin nhắn' })
  @ApiResponse({ status: 200, description: 'Bỏ ghim tin nhắn thành công' })
  @ResponseMessage('Bỏ ghim tin nhắn thành công')
  unpinMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.unpinMessage(id, req.user);
  }

  @Post(':id/recall')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Thu hồi tin nhắn đã gửi' })
  @ApiResponse({ status: 200, description: 'Thu hồi tin nhắn thành công' })
  @ResponseMessage('Thu hồi tin nhắn thành công')
  recallMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.recallMessage(id, req.user);
  }

  @Post('search')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Tìm kiếm tin nhắn theo nội dung' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm tin nhắn' })
  @ResponseMessage('Tìm kiếm tin nhắn thành công')
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
  @ResponseMessage('Đánh dấu cuộc hội thoại đã đọc thành công')
  markConversationAsRead(
    @Query('otherUserId') otherUserId: string,
    @Request() req: RequestWithUser,
  ) {
    // Validate otherUserId exists
    if (!otherUserId) {
      throw new BadRequestException('Thiếu tham số otherUserId');
    }
    return this.messagesService.markConversationAsRead(
      req.user._id,
      otherUserId,
    );
  }

  // ==================== DYNAMIC ROUTES (MUST BE LAST) ====================

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tin nhắn' })
  @ApiResponse({ status: 200, description: 'Thông tin tin nhắn' })
  @ResponseMessage('Lấy thông tin tin nhắn thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Cập nhật nội dung tin nhắn' })
  @ApiResponse({
    status: 200,
    description: 'Tin nhắn được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật tin nhắn thành công')
  update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.update(id, updateMessageDto, req.user);
  }

  @Patch(':id/read')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Đánh dấu tin nhắn đã đọc' })
  @ApiResponse({ status: 200, description: 'Tin nhắn được đánh dấu đã đọc' })
  @ResponseMessage('Đánh dấu tin nhắn đã đọc thành công')
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.markAsRead(id, req.user._id);
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa tin nhắn của mình' })
  @ApiResponse({ status: 204, description: 'Tin nhắn được xóa thành công' })
  @ResponseMessage('Xóa tin nhắn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.remove(id, req.user);
  }
}
