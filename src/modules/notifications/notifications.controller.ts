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
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  QueryNotificationDto,
  AdminQueryNotificationDto,
} from './dto/query-notification.dto';
import { Roles } from '../../decorators/roles.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ==================== USER ENDPOINTS ====================

  @Get()
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy danh sách thông báo thành công')
  findAll(
    @Query() query: QueryNotificationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.findAll(query, req.user);
  }

  @Get('unread-count')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy số thông báo chưa đọc thành công')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user._id);
  }

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy thông tin thông báo thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Cập nhật thông báo thành công')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.notificationsService.update(
      id,
      updateNotificationDto,
      req.user,
    );
  }

  @Patch(':id/read')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Đánh dấu thông báo đã đọc thành công')
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationsService.markAsRead(id, req.user);
  }

  @Patch('read-all')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Đánh dấu tất cả thông báo đã đọc thành công')
  markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa thông báo thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationsService.softDelete(id, req.user);
  }

  @Delete('clear')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Xóa tất cả thông báo thành công')
  clearAll(@Request() req: RequestWithUser) {
    return this.notificationsService.clearAll(req.user);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @Roles('admin')
  @ResponseMessage('Lấy danh sách thông báo cho admin thành công')
  findAllForAdmin(@Query() query: AdminQueryNotificationDto) {
    return this.notificationsService.findAllForAdmin(query);
  }

  @Get('admin/:id')
  @Roles('admin')
  @ResponseMessage('Lấy thông tin thông báo cho admin thành công')
  findOneForAdmin(@Param('id') id: string) {
    return this.notificationsService.findOneForAdmin(id);
  }

  // ==================== INTERNAL SERVICE ENDPOINTS ====================

  @Post('internal/send')
  @Roles('admin') // Hoặc có thể sử dụng internal API key authentication
  @ResponseMessage('Gửi thông báo thành công')
  createAndSend(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createAndSend(createNotificationDto);
  }

  @Post('internal/bulk-send')
  @Roles('admin') // Hoặc có thể sử dụng internal API key authentication
  @ResponseMessage('Gửi thông báo hàng loạt thành công')
  sendBulkNotifications(@Body() notifications: CreateNotificationDto[]) {
    return this.notificationsService.sendBulkNotifications(notifications);
  }
}
