import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async create(@Body() createMessageDto: CreateMessageDto) {
    return await this.messagesService.create(createMessageDto);
  }

  @Get()
  async findAll() {
    return await this.messagesService.findAll();
  }

  @Get('conversations/:userId')
  async getUserConversations(@Param('userId') userId: string) {
    return await this.messagesService.findUserConversations(userId);
  }

  @Get('conversation')
  async getConversation(
    @Query('user1') user1: string,
    @Query('user2') user2: string,
  ) {
    return await this.messagesService.findConversation(user1, user2);
  }

  @Get('unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: string) {
    const count = await this.messagesService.getUnreadCount(userId);
    return { count };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.messagesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return await this.messagesService.update(id, updateMessageDto);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return await this.messagesService.markAsRead(id);
  }

  @Patch('conversation/read')
  async markConversationAsRead(
    @Query('userId') userId: string,
    @Query('otherUserId') otherUserId: string,
  ) {
    await this.messagesService.markConversationAsRead(userId, otherUserId);
    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.messagesService.remove(id);
  }
}
