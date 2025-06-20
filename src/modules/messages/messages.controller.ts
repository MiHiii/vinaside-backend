import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Tạo một tin nhắn mới
   * @body createMessageDto Thông tin tin nhắn cần tạo
   */
  @Post()
  async create(@Body() createMessageDto: CreateMessageDto) {
    return await this.messagesService.create(createMessageDto);
  }

  /**
   * Lấy tất cả tin nhắn (chỉ dùng cho mục đích quản trị hoặc debug)
   */
  @Get()
  async findAll() {
    return await this.messagesService.findAll();
  }

  /**
   * Lấy danh sách các cuộc hội thoại của một người dùng
   * @param userId ID của người dùng
   */
  @Get('conversations/:userId')
  async getUserConversations(@Param('userId') userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return await this.messagesService.findUserConversations(userId);
  }

  /**
   * Lấy cuộc hội thoại giữa hai người dùng
   * @query user1 ID người dùng 1
   * @query user2 ID người dùng 2
   */
  @Get('conversation')
  async getConversation(
    @Query('user1') user1: string,
    @Query('user2') user2: string,
  ) {
    if (!Types.ObjectId.isValid(user1) || !Types.ObjectId.isValid(user2)) {
      throw new BadRequestException('Invalid user ID');
    }
    return await this.messagesService.findConversation(user1, user2);
  }

  /**
   * Lấy số lượng tin nhắn chưa đọc của một người dùng
   * @param userId ID của người dùng
   */
  @Get('unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    const count = await this.messagesService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Lấy thông tin một tin nhắn theo ID
   * @param id ID của tin nhắn
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }
    return await this.messagesService.findOne(id);
  }

  /**
   * Cập nhật nội dung một tin nhắn
   * @param id ID của tin nhắn
   * @body updateMessageDto Dữ liệu cập nhật
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }
    return await this.messagesService.update(id, updateMessageDto);
  }

  /**
   * Đánh dấu một tin nhắn là đã đọc
   * @param id ID của tin nhắn
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }
    return await this.messagesService.markAsRead(id);
  }

  /**
   * Đánh dấu tất cả tin nhắn trong cuộc hội thoại giữa hai người dùng là đã đọc
   * @query userId ID người dùng hiện tại
   * @query otherUserId ID người dùng còn lại
   */
  @Patch('conversation/read')
  async markConversationAsRead(
    @Query('userId') userId: string,
    @Query('otherUserId') otherUserId: string,
  ) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(otherUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    await this.messagesService.markConversationAsRead(userId, otherUserId);
    return { success: true };
  }

  /**
   * Xóa một tin nhắn theo ID
   * @param id ID của tin nhắn
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }
    return await this.messagesService.remove(id);
  }
}
