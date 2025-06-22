import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  SortOrder,
  Types,
} from 'mongoose';
import { WishlistList } from './schemas/wishlist-list.schema';
import { WishlistItem } from './schemas/wishlist-item.schema';
import { CreateWishlistListDto } from './dto/create-wishlist-list.dto';
import { UpdateWishlistListDto } from './dto/update-wishlist-list.dto';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';

interface UpdateFields {
  updatedBy?: Types.ObjectId;
  [key: string]: any;
}

interface DeleteFields {
  isDeleted: boolean;
  deletedAt: Date | undefined;
  deletedBy: Types.ObjectId | undefined;
}

@Injectable()
export class WishlistRepo {
  constructor(
    @InjectModel(WishlistList.name)
    private readonly wishlistListModel: Model<WishlistList>,
    @InjectModel(WishlistItem.name)
    private readonly wishlistItemModel: Model<WishlistItem>,
  ) {}

  // ========================= WISHLIST LIST METHODS =========================

  /**
   * Tạo wishlist list mới
   */
  async createList(
    createWishlistListDto: CreateWishlistListDto,
    userId?: string,
  ): Promise<WishlistList> {
    const createdBy = userId ? new Types.ObjectId(userId) : undefined;

    const data = {
      ...createWishlistListDto,
      user_id: new Types.ObjectId(userId),
      createdBy,
    };

    const wishlistList = new this.wishlistListModel(data);
    return await wishlistList.save();
  }

  /**
   * Tìm wishlist list theo ID
   */
  async findListById(
    id: string,
    populate?: PopulateOptions | Array<PopulateOptions>,
  ): Promise<WishlistList | null> {
    const query = this.wishlistListModel.findById(id);

    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
    }

    return await query.exec();
  }

  /**
   * Tìm tất cả wishlist lists theo điều kiện
   */
  async findAllLists(
    filter: FilterQuery<WishlistList> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: WishlistList[]; total: number }> {
    const { sort, limit, skip, populate } = options;

    const query = this.wishlistListModel.find(filter);

    if (sort) {
      query.sort(sort);
    }

    if (skip !== undefined) {
      query.skip(skip);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
    }

    const [data, total] = await Promise.all([
      query.exec(),
      this.wishlistListModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Tìm wishlist lists của user
   */
  async findListsByUser(
    userId: string,
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: WishlistList[]; total: number }> {
    const filter: FilterQuery<WishlistList> = {
      user_id: new Types.ObjectId(userId),
      isDeleted: false,
    };

    return await this.findAllLists(filter, options);
  }

  /**
   * Cập nhật wishlist list
   */
  async updateListById(
    id: string,
    updateData: Partial<UpdateWishlistListDto>,
    userId?: string,
  ): Promise<WishlistList | null> {
    const dataToUpdate: UpdateFields = { ...updateData };
    if (userId) {
      dataToUpdate.updatedBy = new Types.ObjectId(userId);
    }

    return await this.wishlistListModel
      .findByIdAndUpdate(id, dataToUpdate, { new: true })
      .populate({ path: 'user_id', select: 'name avatar email' })
      .exec();
  }

  /**
   * Xóa mềm wishlist list
   */
  async softDeleteList(
    id: string,
    userId?: string,
  ): Promise<WishlistList | null> {
    const deleteData: DeleteFields = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    return await this.wishlistListModel
      .findByIdAndUpdate(id, deleteData, { new: true })
      .exec();
  }

  /**
   * Xóa cứng wishlist list
   */
  async forceDeleteList(id: string): Promise<boolean> {
    const result = await this.wishlistListModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  // ========================= WISHLIST ITEM METHODS =========================

  /**
   * Thêm item vào wishlist
   */
  async addItem(
    createWishlistItemDto: CreateWishlistItemDto,
    userId?: string,
  ): Promise<WishlistItem> {
    const createdBy = userId ? new Types.ObjectId(userId) : undefined;

    const data = {
      ...createWishlistItemDto,
      wishlist_id: new Types.ObjectId(createWishlistItemDto.wishlist_id),
      room_id: new Types.ObjectId(createWishlistItemDto.room_id),
      createdBy,
    };

    const wishlistItem = new this.wishlistItemModel(data);
    return await wishlistItem.save();
  }

  /**
   * Tìm tất cả items trong một wishlist
   */
  async findItemsByWishlistId(
    wishlistId: string,
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: WishlistItem[]; total: number }> {
    const filter: FilterQuery<WishlistItem> = {
      wishlist_id: new Types.ObjectId(wishlistId),
      isDeleted: false,
    };

    const { sort, limit, skip, populate } = options;

    const query = this.wishlistItemModel.find(filter);

    if (sort) {
      query.sort(sort);
    }

    if (skip !== undefined) {
      query.skip(skip);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
    }

    const [data, total] = await Promise.all([
      query.exec(),
      this.wishlistItemModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Kiểm tra xem item đã tồn tại trong wishlist chưa
   */
  async findItemByWishlistAndRoom(
    wishlistId: string,
    roomId: string,
  ): Promise<WishlistItem | null> {
    return await this.wishlistItemModel
      .findOne({
        wishlist_id: new Types.ObjectId(wishlistId),
        room_id: new Types.ObjectId(roomId),
        isDeleted: false,
      })
      .exec();
  }

  /**
   * Xóa item khỏi wishlist
   */
  async removeItem(
    wishlistId: string,
    roomId: string,
    userId?: string,
  ): Promise<WishlistItem | null> {
    const deleteData: DeleteFields = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    return await this.wishlistItemModel
      .findOneAndUpdate(
        {
          wishlist_id: new Types.ObjectId(wishlistId),
          room_id: new Types.ObjectId(roomId),
          isDeleted: false,
        },
        deleteData,
        { new: true },
      )
      .exec();
  }

  /**
   * Xóa cứng item khỏi wishlist
   */
  async forceDeleteItem(wishlistId: string, roomId: string): Promise<boolean> {
    const result = await this.wishlistItemModel
      .findOneAndDelete({
        wishlist_id: new Types.ObjectId(wishlistId),
        room_id: new Types.ObjectId(roomId),
      })
      .exec();
    return !!result;
  }

  /**
   * Đếm số lượng items trong wishlist
   */
  async countItemsInWishlist(wishlistId: string): Promise<number> {
    return await this.wishlistItemModel.countDocuments({
      wishlist_id: new Types.ObjectId(wishlistId),
      isDeleted: false,
    });
  }

  /**
   * Kiểm tra quyền truy cập wishlist list
   */
  async checkListPermission(
    listId: string,
    userId: string,
    role: string,
  ): Promise<WishlistList> {
    const wishlistList = await this.findListById(listId);

    if (!wishlistList) {
      throw new NotFoundException('Không tìm thấy danh sách yêu thích');
    }

    if (wishlistList.isDeleted) {
      throw new BadRequestException('Danh sách yêu thích đã bị xóa');
    }

    // Admin có thể truy cập tất cả
    if (role === 'admin') {
      return wishlistList;
    }

    // User chỉ có thể truy cập wishlist của mình
    if (wishlistList.user_id.toString() !== userId) {
      throw new BadRequestException(
        'Bạn không có quyền truy cập danh sách này',
      );
    }

    return wishlistList;
  }
}
