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
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  QueryNotificationDto,
  AdminQueryNotificationDto,
} from './dto/query-notification.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
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
} from '@nestjs/swagger';
import { NotificationResponse } from './interfaces/notification.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ==================== USER ENDPOINTS ====================

  @Get()
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách thông báo của tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách thông báo' })
  @ResponseMessage('Lấy danh sách thông báo thành công')
  async findAll(
    @Query() query: QueryNotificationDto,
    @Request() req: RequestWithUser,
  ): Promise<NotificationResponse> {
    const result = (await this.notificationsService.findAll(
      query,
      req.user,
    )) as NotificationResponse;
    // Format notifications: bổ sung avatar_url và sender_user_id nếu cần
    // const notifications = Array.isArray(result.notifications)
    //   ? await this.notificationsService.enrichNotificationDetails(
    //       result.notifications,
    //     )
    //   : [];
    return {
      ...result,
      // notifications,
      notifications: Array.isArray(result.notifications)
        ? result.notifications
        : [],
    };
  }

  @Get('unread-count')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy số thông báo chưa đọc' })
  @ApiResponse({ status: 200, description: 'Số thông báo chưa đọc' })
  @ResponseMessage('Lấy số thông báo chưa đọc thành công')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user._id);
  }

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết thông báo' })
  @ApiResponse({ status: 200, description: 'Thông tin thông báo' })
  @ResponseMessage('Lấy thông tin thông báo thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Cập nhật thông báo' })
  @ApiResponse({
    status: 200,
    description: 'Thông báo được cập nhật thành công',
  })
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

  @Post('all-read')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  @ApiResponse({
    status: 200,
    description: 'Tất cả thông báo được đánh dấu đã đọc',
  })
  @ResponseMessage('Đánh dấu tất cả thông báo đã đọc thành công')
  markAllAsRead(@Request() req: RequestWithUser) {
    console.log('CALLED: all-read');
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Patch(':id/read')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  @ApiResponse({ status: 200, description: 'Thông báo được đánh dấu đã đọc' })
  @ResponseMessage('Đánh dấu thông báo đã đọc thành công')
  markAsRead(@Param('id') id: string, @Request() req: RequestWithUser) {
    console.log('CALLED: id/read', id);
    return this.notificationsService.markAsRead(id, req.user);
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa thông báo' })
  @ApiResponse({ status: 204, description: 'Thông báo được xóa thành công' })
  @ResponseMessage('Xóa thông báo thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.notificationsService.softDelete(id, req.user);
  }

  @Delete('clear')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Xóa tất cả thông báo của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Tất cả thông báo được xóa thành công',
  })
  @ResponseMessage('Xóa tất cả thông báo thành công')
  clearAll(@Request() req: RequestWithUser) {
    return this.notificationsService.clearAll(req.user);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @RequirePermission('notification.send')
  @ApiOperation({ summary: 'Lấy danh sách tất cả thông báo (Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách tất cả thông báo' })
  @ResponseMessage('Lấy danh sách thông báo cho admin thành công')
  findAllForAdmin(@Query() query: AdminQueryNotificationDto) {
    return this.notificationsService.findAllForAdmin(query);
  }

  @Get('admin/:id')
  @RequirePermission('notification.send')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết thông báo (Admin)' })
  @ApiResponse({ status: 200, description: 'Thông tin thông báo' })
  @ResponseMessage('Lấy thông tin thông báo cho admin thành công')
  findOneForAdmin(@Param('id') id: string) {
    return this.notificationsService.findOneForAdmin(id);
  }

  // ==================== INTERNAL SERVICE ENDPOINTS ====================

  @Post('internal/send')
  @RequirePermission('notification.send')
  @ApiOperation({ summary: 'Gửi thông báo đơn lẻ' })
  @ApiResponse({ status: 201, description: 'Thông báo được gửi thành công' })
  @ResponseMessage('Gửi thông báo thành công')
  createAndSend(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createAndSend(createNotificationDto);
  }

  @Post('internal/bulk-send')
  @RequirePermission('notification.broadcast')
  @ApiOperation({ summary: 'Gửi thông báo hàng loạt' })
  @ApiResponse({
    status: 201,
    description: 'Thông báo hàng loạt được gửi thành công',
  })
  @ResponseMessage('Gửi thông báo hàng loạt thành công')
  sendBulkNotifications(@Body() notifications: CreateNotificationDto[]) {
    return this.notificationsService.sendBulkNotifications(notifications);
  }
}
