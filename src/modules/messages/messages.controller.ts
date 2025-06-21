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
import { AddReactionDto, RemoveReactionDto } from './dto/reaction.dto';
import { ReactionType } from './schemas/message.schema';
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
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Tạo tin nhắn thành công')
  create(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.create(createMessageDto, req.user);
  }

  @Get()
  @Roles('admin')
  @ResponseMessage('Lấy danh sách tin nhắn thành công')
  findAll() {
    return this.messagesService.findAll();
  }

  @Get('conversations')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy danh sách cuộc hội thoại thành công')
  getUserConversations(@Request() req: RequestWithUser) {
    return this.messagesService.findUserConversations(req.user._id);
  }

  @Get('available-users')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy danh sách người dùng có thể nhắn tin thành công')
  getAvailableUsers(@Request() req: RequestWithUser) {
    return this.messagesService.getAvailableUsers(req.user._id);
  }

  @Get('conversation')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy cuộc hội thoại thành công')
  getConversation(
    @Query('otherUserId') otherUserId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.findConversation(req.user._id, otherUserId);
  }

  @Get('unread-count')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy số tin nhắn chưa đọc thành công')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.messagesService.getUnreadCount(req.user._id);
  }

  @Get('all-users')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy danh sách tất cả người dùng thành công')
  getAllUsers(@Request() req: RequestWithUser) {
    return this.messagesService.getAllUsers(req.user._id);
  }

  // ==================== REACTION ENDPOINTS ====================

  @Post('reactions/add')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Thêm reaction thành công')
  addReaction(
    @Body() addReactionDto: AddReactionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.addReaction(addReactionDto, req.user);
  }

  @Post('reactions/remove')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Xóa reaction thành công')
  removeReaction(
    @Body() removeReactionDto: RemoveReactionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.removeReaction(removeReactionDto, req.user);
  }

  @Post(':messageId/reactions/toggle/:reactionType')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Toggle reaction thành công')
  toggleReaction(
    @Param('messageId') messageId: string,
    @Param('reactionType') reactionType: ReactionType,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.toggleReaction(
      messageId,
      reactionType,
      req.user,
    );
  }

  @Get(':id')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy thông tin tin nhắn thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Cập nhật tin nhắn thành công')
  update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req: RequestWithUser,
  ) {
    return this.messagesService.update(id, updateMessageDto, req.user);
  }

  @Patch(':id/read')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Đánh dấu tin nhắn đã đọc thành công')
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.markAsRead(id, req.user);
  }

  @Patch('conversation/read')
  @Roles('guest', 'host', 'admin')
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
  @Roles('guest', 'host', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa tin nhắn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.messagesService.remove(id, req.user);
  }
}
