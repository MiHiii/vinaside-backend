import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { AdminQueryWishlistDto } from './dto/admin-query-wishlist.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { WishlistRepo } from './wishlist.repo';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly wishlistRepo: WishlistRepo) {}

  // =========================== USER API METHODS ===========================

  /**
   * Lấy danh sách yêu thích của user
   */
  async getMyWishlists(user: JwtPayload, queryDto: QueryWishlistDto) {
    try {
      const result = await this.wishlistRepo.findAll(queryDto, user._id);

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit) || 1,
        },
      };
    } catch (error) {
      this.handleError(error, 'lấy danh sách yêu thích');
    }
  }

  /**
   * Xóa wishlist (xóa mềm) - bất kỳ user nào cũng có thể xóa
   */
  async remove(id: string) {
    try {
      await this.wishlistRepo.softDelete(id);

      return {
        success: true,
        message: 'Đã xóa khỏi danh sách yêu thích',
      };
    } catch (error) {
      this.handleError(error, 'xóa wishlist');
    }
  }

  /**
   * Kiểm tra phòng đã được yêu thích chưa
   */
  async checkFavorite(roomId: string, user: JwtPayload) {
    try {
      const exists = await this.wishlistRepo.checkExisting(user._id, roomId);

      return {
        success: true,
        isFavorite: exists,
      };
    } catch (error) {
      this.handleError(error, 'kiểm tra yêu thích');
    }
  }

  /**
   * Toggle yêu thích (update isDelete thay vì tạo/xóa record để tránh duplicate key)
   */
  async toggleFavorite(roomId: string, user: JwtPayload) {
    try {
      const result = await this.wishlistRepo.toggleWishlist(user._id, roomId);

      return {
        success: true,
        action: result.action,
        message:
          result.action === 'added'
            ? 'Đã thêm vào danh sách yêu thích'
            : 'Đã xóa khỏi danh sách yêu thích',
        data: result.data,
      };
    } catch (error) {
      this.handleError(error, 'toggle yêu thích');
    }
  }

  // =========================== ADMIN API METHODS ===========================

  /**
   * Admin lấy tất cả wishlist
   */
  async getAllForAdmin(queryDto: AdminQueryWishlistDto) {
    try {
      const result = await this.wishlistRepo.findAllForAdmin(queryDto);

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit) || 1,
        },
      };
    } catch (error) {
      this.handleError(error, 'lấy danh sách wishlist (admin)');
    }
  }

  /**
   * Admin lấy thống kê wishlist
   */
  async getStatistics() {
    try {
      const stats = await this.wishlistRepo.getStatistics();

      return {
        success: true,
        data: {
          topRooms: stats.topRooms,
          topUsers: stats.topUsers,
          last7Days: stats.last7Days,
          summary: {
            totalTopRooms: stats.topRooms.length,
            totalTopUsers: stats.topUsers.length,
            recentActivity: stats.last7Days,
          },
        },
      };
    } catch (error) {
      this.handleError(error, 'lấy thống kê wishlist');
    }
  }

  /**
   * Admin xóa cứng wishlist
   */
  async forceDelete(id: string) {
    try {
      const result = await this.wishlistRepo.forceDelete(id);

      if (!result) {
        throw new NotFoundException('Không tìm thấy wishlist để xóa');
      }

      return {
        success: true,
        message: 'Đã xóa cứng wishlist',
      };
    } catch (error) {
      this.handleError(error, 'xóa cứng wishlist');
    }
  }

  /**
   * Admin khôi phục wishlist đã xóa mềm
   */
  async restore(id: string) {
    try {
      const wishlist = await this.wishlistRepo.restore(id);

      if (!wishlist) {
        throw new NotFoundException('Không tìm thấy wishlist để khôi phục');
      }

      return {
        success: true,
        message: 'Đã khôi phục wishlist',
        data: wishlist,
      };
    } catch (error) {
      this.handleError(error, 'khôi phục wishlist');
    }
  }

  // =========================== PRIVATE METHODS ===========================

  /**
   * Xử lý lỗi chung
   */
  private handleError(error: any, operation: string): never {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Lỗi khi ${operation}: ${errorMessage}`, errorStack);

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    throw new BadRequestException(`Có lỗi xảy ra khi ${operation}`);
  }
}
