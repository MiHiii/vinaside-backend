import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { WishlistList } from './schemas/wishlist-list.schema';
import { WishlistItem } from './schemas/wishlist-item.schema';
import { CreateWishlistListDto } from './dto/create-wishlist-list.dto';
import { UpdateWishlistListDto } from './dto/update-wishlist-list.dto';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { WishlistRepo } from './wishlist.repo';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly wishlistRepo: WishlistRepo) {}

  // =========================== WISHLIST LIST API METHODS ===========================

  /**
   * Tạo một wishlist list mới
   */
  async createList(
    createWishlistListDto: CreateWishlistListDto,
    user: JwtPayload,
  ) {
    const wishlistList = await this.createWishlistList(
      createWishlistListDto,
      user,
    );
    return { wishlistList };
  }

  /**
   * Lấy danh sách wishlist lists của user
   */
  async getMyLists(user: JwtPayload, queryDto: QueryWishlistDto) {
    const result = await this.findListsByUser(user._id, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      wishlistLists: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Lấy một wishlist list theo ID
   */
  async getListById(id: string, user: JwtPayload) {
    const wishlistList = await this.findWishlistListById(id, user);
    return { wishlistList };
  }

  /**
   * Cập nhật wishlist list
   */
  async updateList(
    id: string,
    updateWishlistListDto: UpdateWishlistListDto,
    user: JwtPayload,
  ) {
    const wishlistList = await this.updateWishlistList(
      id,
      updateWishlistListDto,
      user,
    );
    return { wishlistList };
  }

  /**
   * Xóa mềm wishlist list
   */
  async deleteList(id: string, user: JwtPayload) {
    await this.softDeleteWishlistList(id, user);
    return { success: true };
  }

  // =========================== WISHLIST ITEM API METHODS ===========================

  /**
   * Thêm phòng vào wishlist
   */
  async addItemToList(
    createWishlistItemDto: CreateWishlistItemDto,
    user: JwtPayload,
  ) {
    const wishlistItem = await this.addWishlistItem(
      createWishlistItemDto,
      user,
    );
    return { wishlistItem };
  }

  /**
   * Lấy danh sách phòng trong wishlist
   */
  async getItemsInList(
    wishlistId: string,
    user: JwtPayload,
    queryDto: QueryWishlistDto,
  ) {
    const result = await this.findItemsInWishlist(wishlistId, user, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      wishlistItems: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Xóa phòng khỏi wishlist
   */
  async removeItemFromList(
    wishlistId: string,
    roomId: string,
    user: JwtPayload,
  ) {
    await this.removeWishlistItem(wishlistId, roomId, user);
    return { success: true };
  }

  /**
   * Kiểm tra phòng có trong wishlist không
   */
  async checkItemInList(wishlistId: string, roomId: string, user: JwtPayload) {
    const exists = await this.isItemInWishlist(wishlistId, roomId, user);
    return { exists };
  }

  // =========================== PRIVATE METHODS ===========================

  /**
   * Tạo wishlist list mới
   */
  private async createWishlistList(
    createWishlistListDto: CreateWishlistListDto,
    user: JwtPayload,
  ): Promise<WishlistList> {
    try {
      const listData = {
        ...createWishlistListDto,
        user_id: user._id,
      };

      return await this.wishlistRepo.createList(listData, user._id);
    } catch (error) {
      this.handleError(error, 'tạo danh sách yêu thích');
    }
  }

  /**
   * Tìm danh sách wishlist lists của user
   */
  private async findListsByUser(userId: string, queryDto: QueryWishlistDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = queryDto;
      const skip = (page - 1) * limit;

      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 } as Record<
        string,
        1 | -1
      >;

      const options = {
        sort,
        limit,
        skip,
        populate: [{ path: 'user_id', select: 'name avatar email' }],
      };

      return await this.wishlistRepo.findListsByUser(userId, options);
    } catch (error) {
      this.handleError(error, 'lấy danh sách wishlist');
    }
  }

  /**
   * Tìm wishlist list theo ID
   */
  private async findWishlistListById(
    id: string,
    user: JwtPayload,
  ): Promise<WishlistList> {
    try {
      await this.wishlistRepo.checkListPermission(
        id,
        user._id,
        user.role || 'user',
      );

      const wishlistList = await this.wishlistRepo.findListById(id, [
        { path: 'user_id', select: 'name avatar email' },
      ]);

      if (!wishlistList) {
        throw new NotFoundException('Không tìm thấy danh sách yêu thích');
      }

      return wishlistList;
    } catch (error) {
      this.handleError(error, 'lấy thông tin danh sách yêu thích');
    }
  }

  /**
   * Cập nhật wishlist list
   */
  private async updateWishlistList(
    id: string,
    updateWishlistListDto: UpdateWishlistListDto,
    user: JwtPayload,
  ): Promise<WishlistList> {
    try {
      await this.wishlistRepo.checkListPermission(
        id,
        user._id,
        user.role || 'user',
      );

      const updatedList = await this.wishlistRepo.updateListById(
        id,
        updateWishlistListDto,
        user._id,
      );

      if (!updatedList) {
        throw new NotFoundException(
          'Không tìm thấy danh sách yêu thích để cập nhật',
        );
      }

      return updatedList;
    } catch (error) {
      this.handleError(error, 'cập nhật danh sách yêu thích');
    }
  }

  /**
   * Xóa mềm wishlist list
   */
  private async softDeleteWishlistList(
    id: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      await this.wishlistRepo.checkListPermission(
        id,
        user._id,
        user.role || 'user',
      );

      const deletedList = await this.wishlistRepo.softDeleteList(id, user._id);

      if (!deletedList) {
        throw new NotFoundException(
          'Không tìm thấy danh sách yêu thích để xóa',
        );
      }
    } catch (error) {
      this.handleError(error, 'xóa danh sách yêu thích');
    }
  }

  /**
   * Thêm item vào wishlist
   */
  private async addWishlistItem(
    createWishlistItemDto: CreateWishlistItemDto,
    user: JwtPayload,
  ): Promise<WishlistItem> {
    try {
      // Kiểm tra quyền truy cập wishlist
      await this.wishlistRepo.checkListPermission(
        createWishlistItemDto.wishlist_id,
        user._id,
        user.role || 'user',
      );

      // Kiểm tra xem item đã tồn tại chưa
      const existingItem = await this.wishlistRepo.findItemByWishlistAndRoom(
        createWishlistItemDto.wishlist_id,
        createWishlistItemDto.room_id,
      );

      if (existingItem) {
        throw new BadRequestException(
          'Phòng này đã có trong danh sách yêu thích',
        );
      }

      return await this.wishlistRepo.addItem(createWishlistItemDto, user._id);
    } catch (error) {
      this.handleError(error, 'thêm phòng vào danh sách yêu thích');
    }
  }

  /**
   * Lấy danh sách items trong wishlist
   */
  private async findItemsInWishlist(
    wishlistId: string,
    user: JwtPayload,
    queryDto: QueryWishlistDto,
  ) {
    try {
      // Kiểm tra quyền truy cập wishlist
      await this.wishlistRepo.checkListPermission(
        wishlistId,
        user._id,
        user.role || 'user',
      );

      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = queryDto;
      const skip = (page - 1) * limit;

      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 } as Record<
        string,
        1 | -1
      >;

      const options = {
        sort,
        limit,
        skip,
        populate: [
          {
            path: 'room_id',
            select:
              'title description images address price_per_night property_type',
          },
          {
            path: 'wishlist_id',
            select: 'name',
          },
        ],
      };

      return await this.wishlistRepo.findItemsByWishlistId(wishlistId, options);
    } catch (error) {
      this.handleError(error, 'lấy danh sách phòng yêu thích');
    }
  }

  /**
   * Xóa item khỏi wishlist
   */
  private async removeWishlistItem(
    wishlistId: string,
    roomId: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      // Kiểm tra quyền truy cập wishlist
      await this.wishlistRepo.checkListPermission(
        wishlistId,
        user._id,
        user.role || 'user',
      );

      const removedItem = await this.wishlistRepo.removeItem(
        wishlistId,
        roomId,
        user._id,
      );

      if (!removedItem) {
        throw new NotFoundException(
          'Không tìm thấy phòng trong danh sách yêu thích',
        );
      }
    } catch (error) {
      this.handleError(error, 'xóa phòng khỏi danh sách yêu thích');
    }
  }

  /**
   * Kiểm tra item có trong wishlist không
   */
  private async isItemInWishlist(
    wishlistId: string,
    roomId: string,
    user: JwtPayload,
  ): Promise<boolean> {
    try {
      // Kiểm tra quyền truy cập wishlist
      await this.wishlistRepo.checkListPermission(
        wishlistId,
        user._id,
        user.role || 'user',
      );

      const item = await this.wishlistRepo.findItemByWishlistAndRoom(
        wishlistId,
        roomId,
      );
      return !!item;
    } catch (error) {
      this.handleError(error, 'kiểm tra phòng trong danh sách yêu thích');
    }
  }

  /**
   * Xử lý lỗi
   */
  private handleError(error: any, operation: string): never {
    this.logger.error(`Lỗi khi ${operation}:`, error.stack);

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    throw new BadRequestException(
      `Không thể ${operation}. Vui lòng thử lại sau.`,
    );
  }
}
