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
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AddReactionDto } from './dto/reaction.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { SearchMessageDto } from './dto/search-message.dto';
import { Roles } from '../../decorators/roles.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Gửi tin nhắn thành công')
  create(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.create(createMessageDto, req.user);
  }

  @Get()
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy danh sách tin nhắn thành công')
  findAll(@Query() query: QueryMessageDto, @Request() req: RequestWithUser) {
    return this.messagesService.findAll(query, req.user);
  }

  @Get('conversations')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy danh sách cuộc trò chuyện thành công')
  getConversations(@Request() req: RequestWithUser) {
    return this.messagesService.getConversations(req.user._id);
  }

  @Get('conversation/:userId')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy tin nhắn trong cuộc trò chuyện thành công')
  getConversation(
    @Param('userId') userId: string,
    @Query() query: QueryMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.getConversation(req.user._id, userId, query);
  }

  @Get('unread-count')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy số tin nhắn chưa đọc thành công')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.messagesService.getUnreadCount(req.user._id);
  }

  @Get('all-users')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy danh sách tất cả người dùng thành công')
  getAllUsers(@Request() req: RequestWithUser) {
    return this.messagesService.getAllUsers(req.user._id);
  }

  // ==================== REACTION ENDPOINTS ====================

  @Post(':id/reactions')
  @Roles('guest', 'staff', 'admin')
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
  @ResponseMessage('Xóa reaction thành công')
  removeReaction(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.removeReaction(id, req.user);
  }

  @Patch(':id/pin')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Ghim tin nhắn thành công')
  pinMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.pinMessage(id, req.user);
  }

  @Patch(':id/unpin')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Bỏ ghim tin nhắn thành công')
  unpinMessage(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.unpinMessage(id, req.user);
  }

  @Post('search')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Tìm kiếm tin nhắn thành công')
  search(
    @Body() searchMessageDto: SearchMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.search(searchMessageDto, req.user);
  }

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy thông tin tin nhắn thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
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
  @ResponseMessage('Đánh dấu tin nhắn đã đọc thành công')
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.markAsRead(id, req.user._id);
  }

  @Patch('conversation/read')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Đánh dấu cuộc hội thoại đã đọc thành công')
  markConversationAsRead(
    @Query('otherUserId') otherUserId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.markConversationAsRead(
      req.user._id,
      otherUserId,
    );
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa tin nhắn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.remove(id, req.user);
  }
}
