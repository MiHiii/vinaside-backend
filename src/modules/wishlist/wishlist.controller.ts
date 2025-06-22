import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Request,
  Put,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { AdminQueryWishlistDto } from './dto/admin-query-wishlist.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Roles } from 'src/decorators/roles.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('wishlists')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // =========================== USER ENDPOINTS ===========================

  /**
   * [POST] /wishlists/rooms/:roomId/toggle - Toggle trạng thái yêu thích
   * Chức năng: Thêm/xóa phòng khỏi danh sách yêu thích (sử dụng soft delete để tránh duplicate key)
   * Params: roomId - ID của phòng cần toggle
   * Response: { action: 'added'/'removed', message, data: wishlist_info }
   * Logic: Nếu đã có record → toggle isDelete, nếu chưa có → tạo mới
   */
  @Post('rooms/:roomId/toggle')
  @ResponseMessage('Toggle yêu thích thành công')
  toggleFavorite(
    @Param('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.toggleFavorite(roomId, req.user);
  }

  /**
   * [GET] /wishlists - Lấy danh sách yêu thích của user hiện tại
   * Chức năng: Trả về tất cả phòng trong danh sách yêu thích của user đang đăng nhập
   * Query params: page, limit, sortBy, sortOrder, room_id, from_date, to_date, isDelete, includeDeleted
   * Response: Danh sách wishlist với thông tin phòng và user đã populate, có phân trang
   */
  @Get()
  @ResponseMessage('Lấy danh sách yêu thích thành công')
  getMyWishlists(
    @Query() queryDto: QueryWishlistDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.getMyWishlists(req.user, queryDto);
  }

  /**
   * [DELETE] /wishlists/:id - Xóa một wishlist cụ thể theo ID
   * Chức năng: Xóa mềm (soft delete) một record wishlist theo ID
   * Params: id - ID của wishlist record cần xóa
   * Response: { success: true, message }
   * Note: Bất kỳ user nào cũng có thể xóa wishlist
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Xóa khỏi danh sách yêu thích thành công')
  remove(@Param('id') id: string) {
    return this.wishlistService.remove(id);
  }

  /**
   * [GET] /wishlists/rooms/:roomId/check - Kiểm tra phòng có trong yêu thích không
   * Chức năng: Kiểm tra xem một phòng cụ thể có trong danh sách yêu thích của user không
   * Params: roomId - ID của phòng cần kiểm tra
   * Response: { success: true, isFavorite: boolean }
   */
  @Get('rooms/:roomId/check')
  @ResponseMessage('Kiểm tra trạng thái yêu thích thành công')
  checkFavorite(
    @Param('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.checkFavorite(roomId, req.user);
  }
}

// =========================== ADMIN CONTROLLER ===========================

@Controller('admin/wishlists')
export class AdminWishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * [GET] /admin/wishlists - Lấy tất cả wishlist của tất cả user (Admin only)
   * Chức năng: Admin xem toàn bộ danh sách yêu thích của tất cả người dùng
   * Query params: page, limit, sortBy, sortOrder, user_id, room_id, from_date, to_date, isDelete
   * Response: Danh sách tất cả wishlist với thông tin user và phòng, có phân trang và filter
   */
  @Get()
  @Roles('admin')
  @ResponseMessage('Lấy tất cả wishlist thành công')
  getAllWishlists(@Query() queryDto: AdminQueryWishlistDto) {
    return this.wishlistService.getAllForAdmin(queryDto);
  }

  /**
   * [GET] /admin/wishlists/statistics - Thống kê wishlist (Admin only)
   * Chức năng: Thống kê các dữ liệu quan trọng về wishlist
   * Response: {
   *   topRooms: Top 10 phòng được yêu thích nhiều nhất,
   *   topUsers: Top 10 user có nhiều yêu thích nhất,
   *   last7Days: Số lượt yêu thích trong 7 ngày qua
   * }
   */
  @Get('statistics')
  @Roles('admin')
  @ResponseMessage('Lấy thống kê wishlist thành công')
  getStatistics() {
    return this.wishlistService.getStatistics();
  }

  /**
   * [DELETE] /admin/wishlists/:id - Xóa cứng wishlist (Admin only)
   * Chức năng: Admin xóa vĩnh viễn một record wishlist khỏi database
   * Params: id - ID của wishlist record cần xóa cứng
   */
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Xóa cứng wishlist thành công')
  forceDelete(@Param('id') id: string) {
    return this.wishlistService.forceDelete(id);
  }

  /**
   * [Put] /admin/wishlists/:id/restore - Khôi phục wishlist đã soft delete (Admin only)
   * Chức năng: Admin khôi phục một wishlist đã bị xóa mềm (isDelete: true → false)
   */
  @Put(':id/restore')
  @Roles('admin')
  @ResponseMessage('Khôi phục wishlist thành công')
  restore(@Param('id') id: string) {
    return this.wishlistService.restore(id);
  }
}
