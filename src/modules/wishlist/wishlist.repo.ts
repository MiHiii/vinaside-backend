import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  SortOrder,
  Types,
  PipelineStage,
} from 'mongoose';
import { Wishlist } from './schemas/wishlist.schema';
import { Listing } from '../listing/schemas/listing.schema';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { AdminQueryWishlistDto } from './dto/admin-query-wishlist.dto';
import { SearchWishlistDto } from './dto/search-wishlist.dto';

@Injectable()
export class WishlistRepo {
  constructor(
    @InjectModel(Wishlist.name)
    private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<Listing>,
  ) {}

  /**
   * Tìm wishlist theo ID
   */
  async findById(
    id: string,
    populate?: PopulateOptions | Array<PopulateOptions>,
  ): Promise<Wishlist | null> {
    const query = this.wishlistModel.findById(id);

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
   * Tìm tất cả wishlist theo điều kiện (cho user)
   */
  async findAll(
    queryDto: QueryWishlistDto,
    userId?: string,
  ): Promise<{ data: Wishlist[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      user_id,
      property_id,
      room_id,
      from_date,
      to_date,
      isDelete,
      includeDeleted = false,
    } = queryDto;

    // Tạo filter
    const filter: FilterQuery<Wishlist> = {};

    // Nếu có userId từ auth, ưu tiên userId đó
    if (userId) {
      filter.user_id = new Types.ObjectId(userId);
    } else if (user_id) {
      filter.user_id = new Types.ObjectId(user_id);
    }

    if (property_id) {
      filter.property_id = new Types.ObjectId(property_id);
    }

    if (room_id) {
      filter.room_id = new Types.ObjectId(room_id);
    }

    if (!includeDeleted) {
      filter.isDelete = false;
    } else if (isDelete !== undefined) {
      filter.isDelete = isDelete;
    }

    // Lọc theo ngày
    if (from_date || to_date) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (from_date) {
        dateFilter.$gte = new Date(from_date);
      }
      if (to_date) {
        dateFilter.$lte = new Date(to_date);
      }
      filter.created_at = dateFilter;
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder };

    const query = this.wishlistModel
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'user_id', select: 'name email avatar' })
      .populate({ path: 'property_id', select: 'name location' })
      .populate({
        path: 'room_id',
        select:
          'title images price_per_night guests max_guests average_rating reviews_count location',
      });

    const [data, total] = await Promise.all([
      query.exec(),
      this.wishlistModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Tìm tất cả wishlist theo điều kiện (cho admin)
   */
  async findAllForAdmin(
    queryDto: AdminQueryWishlistDto,
  ): Promise<{ data: Wishlist[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      user_id,
      property_id,
      room_id,
      from_date,
      to_date,
      isDelete,
    } = queryDto;

    // Tạo filter
    const filter: FilterQuery<Wishlist> = {};

    if (user_id) {
      filter.user_id = new Types.ObjectId(user_id);
    }

    if (property_id) {
      filter.property_id = new Types.ObjectId(property_id);
    }

    if (room_id) {
      filter.room_id = new Types.ObjectId(room_id);
    }

    if (isDelete !== undefined) {
      filter.isDelete = isDelete;
    }

    // Lọc theo ngày
    if (from_date || to_date) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (from_date) {
        dateFilter.$gte = new Date(from_date);
      }
      if (to_date) {
        dateFilter.$lte = new Date(to_date);
      }
      filter.created_at = dateFilter;
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, SortOrder> = { [sortBy]: sortOrder };

    const query = this.wishlistModel
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'user_id', select: 'name email avatar' })
      .populate({ path: 'property_id', select: 'name location' })
      .populate({
        path: 'room_id',
        select:
          'title images price_per_night guests max_guests average_rating reviews_count location',
      });

    const [data, total] = await Promise.all([
      query.exec(),
      this.wishlistModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Xóa mềm wishlist (bất kỳ user nào cũng có thể xóa)
   */
  async softDelete(id: string): Promise<Wishlist | null> {
    // Kiểm tra wishlist có tồn tại và chưa bị xóa
    const wishlist = await this.wishlistModel.findOne({
      _id: new Types.ObjectId(id),
      isDelete: false,
    });

    if (!wishlist) {
      throw new NotFoundException('Không tìm thấy wishlist hoặc đã bị xóa');
    }

    return await this.wishlistModel
      .findByIdAndUpdate(id, { isDelete: true }, { new: true })
      .exec();
  }

  /**
   * Xóa cứng wishlist (chỉ admin)
   */
  async forceDelete(id: string): Promise<boolean> {
    const result = await this.wishlistModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Khôi phục wishlist đã xóa mềm (admin)
   */
  async restore(id: string): Promise<Wishlist | null> {
    return await this.wishlistModel
      .findByIdAndUpdate(id, { isDelete: false }, { new: true })
      .populate({ path: 'user_id', select: 'name email avatar' })
      .populate({ path: 'property_id', select: 'name location' })
      .populate({
        path: 'room_id',
        select:
          'title images price_per_night guests max_guests average_rating reviews_count location',
      });
  }

  /**
   * Kiểm tra xem phòng đã được yêu thích chưa (chỉ kiểm tra những record chưa bị xóa mềm)
   */
  async checkExisting(userId: string, roomId: string): Promise<boolean> {
    const existing = await this.wishlistModel.findOne({
      user_id: new Types.ObjectId(userId),
      room_id: new Types.ObjectId(roomId),
      isDelete: false,
    });
    return !!existing;
  }

  /**
   * Tìm wishlist record (bao gồm cả đã soft delete) để update
   */
  async findWishlistRecord(
    userId: string,
    roomId: string,
  ): Promise<Wishlist | null> {
    return await this.wishlistModel.findOne({
      user_id: new Types.ObjectId(userId),
      room_id: new Types.ObjectId(roomId),
    });
  }

  /**
   * Xóa wishlist theo user_id và room_id (soft delete)
   */
  async removeByUserAndRoom(
    userId: string,
    roomId: string,
  ): Promise<Wishlist | null> {
    return await this.wishlistModel
      .findOneAndUpdate(
        {
          user_id: new Types.ObjectId(userId),
          room_id: new Types.ObjectId(roomId),
          isDelete: false,
        },
        { isDelete: true },
        { new: true },
      )
      .exec();
  }

  /**
   * Toggle trạng thái yêu thích (update isDelete thay vì tạo/xóa record)
   * Cách này tránh lỗi duplicate key và giữ được lịch sử
   */
  async toggleWishlist(
    userId: string,
    roomId: string,
  ): Promise<{ action: 'added' | 'removed'; data: Wishlist }> {
    // Tìm record hiện có (kể cả đã soft delete)
    const existingRecord = await this.findWishlistRecord(userId, roomId);

    if (existingRecord) {
      // Nếu đã có record, toggle isDelete
      const newIsDelete = !existingRecord.isDelete;
      const updatedRecord = await this.wishlistModel
        .findByIdAndUpdate(
          existingRecord._id,
          { isDelete: newIsDelete },
          { new: true },
        )
        .populate({ path: 'property_id', select: 'name location' })
        .populate({
          path: 'room_id',
          select:
            'title images price_per_night guests max_guests average_rating reviews_count location',
        });

      return {
        action: newIsDelete ? 'removed' : 'added',
        data: updatedRecord as Wishlist,
      };
    } else {
      // Lấy property_id từ listing trước khi tạo wishlist
      const listing = await this.listingModel
        .findById(roomId)
        .select('propertyId');

      if (!listing) {
        throw new Error('Listing not found');
      }

      // Nếu chưa có record, tạo mới
      const newWishlist = new this.wishlistModel({
        user_id: new Types.ObjectId(userId),
        property_id: listing.propertyId,
        room_id: new Types.ObjectId(roomId),
        isDelete: false,
      });

      const savedWishlist = await newWishlist.save();
      const populatedWishlist = await this.wishlistModel
        .findById(savedWishlist._id)
        .populate({ path: 'property_id', select: 'name location' })
        .populate({
          path: 'room_id',
          select:
            'title images price_per_night guests max_guests average_rating reviews_count location',
        });

      return {
        action: 'added',
        data: populatedWishlist as Wishlist,
      };
    }
  }

  /**
   * Tìm kiếm wishlist với nhiều tiêu chí
   */
  async searchWishlists(
    searchDto: SearchWishlistDto,
    userId?: string,
  ): Promise<{ data: Wishlist[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      keyword,
      roomTitle,
      propertyName,
      address,
      userName,
      userEmail,
      minPrice,
      maxPrice,
      minGuests,
      maxGuests,
      minRating,
      maxRating,
      user_id,
      property_id,
      room_id,
      from_date,
      to_date,
      isDelete,
      includeDeleted = false,
    } = searchDto;

    // Tạo filter cơ bản
    const filter: FilterQuery<Wishlist> = {};

    // Nếu có userId từ auth, ưu tiên userId đó
    if (userId) {
      filter.user_id = new Types.ObjectId(userId);
    } else if (user_id) {
      filter.user_id = new Types.ObjectId(user_id);
    }

    if (property_id) {
      filter.property_id = new Types.ObjectId(property_id);
    }

    if (room_id) {
      filter.room_id = new Types.ObjectId(room_id);
    }

    // Mặc định chỉ lấy dữ liệu chưa bị xóa mềm
    if (isDelete !== undefined) {
      filter.isDelete = isDelete;
    } else if (!includeDeleted) {
      filter.isDelete = false;
    }

    // Lọc theo ngày
    if (from_date || to_date) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (from_date) {
        dateFilter.$gte = new Date(from_date);
      }
      if (to_date) {
        dateFilter.$lte = new Date(to_date);
      }
      filter.created_at = dateFilter;
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    // Tạo pipeline aggregation để search
    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'property_id',
          foreignField: '_id',
          as: 'property',
        },
      },
      {
        $lookup: {
          from: 'listings',
          localField: 'room_id',
          foreignField: '_id',
          as: 'room',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$property', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
    ];

    // Thêm điều kiện search
    const searchConditions: any[] = [];

    // Search theo keyword (tìm trong tên phòng, tên property, địa chỉ, tên user)
    if (keyword) {
      searchConditions.push({
        $or: [
          { 'room.title': { $regex: keyword, $options: 'i' } },
          { 'property.name': { $regex: keyword, $options: 'i' } },
          { 'property.location.address': { $regex: keyword, $options: 'i' } },
          { 'user.name': { $regex: keyword, $options: 'i' } },
        ],
      });
    }

    // Search theo tên phòng
    if (roomTitle) {
      searchConditions.push({
        'room.title': { $regex: roomTitle, $options: 'i' },
      });
    }

    // Search theo tên property
    if (propertyName) {
      searchConditions.push({
        'property.name': { $regex: propertyName, $options: 'i' },
      });
    }

    // Search theo địa chỉ
    if (address) {
      searchConditions.push({
        'property.location.address': { $regex: address, $options: 'i' },
      });
    }

    // Search theo tên user
    if (userName) {
      searchConditions.push({
        'user.name': { $regex: userName, $options: 'i' },
      });
    }

    // Search theo email user
    if (userEmail) {
      searchConditions.push({
        'user.email': { $regex: userEmail, $options: 'i' },
      });
    }

    // Lọc theo khoảng giá
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (minPrice !== undefined) priceFilter.$gte = minPrice;
      if (maxPrice !== undefined) priceFilter.$lte = maxPrice;
      searchConditions.push({ 'room.price_per_night': priceFilter });
    }

    // Lọc theo số khách
    if (minGuests !== undefined || maxGuests !== undefined) {
      const guestsFilter: Record<string, number> = {};
      if (minGuests !== undefined) guestsFilter.$gte = minGuests;
      if (maxGuests !== undefined) guestsFilter.$lte = maxGuests;
      searchConditions.push({ 'room.max_guests': guestsFilter });
    }

    // Lọc theo rating
    if (minRating !== undefined || maxRating !== undefined) {
      const ratingFilter: Record<string, number> = {};
      if (minRating !== undefined) ratingFilter.$gte = minRating;
      if (maxRating !== undefined) ratingFilter.$lte = maxRating;
      searchConditions.push({ 'room.average_rating': ratingFilter });
    }

    // Thêm điều kiện search vào pipeline
    if (searchConditions.length > 0) {
      pipeline.push({ $match: { $and: searchConditions } });
    }

    // Thêm sort và pagination
    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          user_id: 1,
          property_id: 1,
          room_id: 1,
          isDelete: 1,
          created_at: 1,
          updated_at: 1,
          'user.name': 1,
          'user.email': 1,
          'user.avatar': 1,
          'property.name': 1,
          'property.location': 1,
          'room.title': 1,
          'room.images': 1,
          'room.price_per_night': 1,
          'room.guests': 1,
          'room.max_guests': 1,
          'room.average_rating': 1,
          'room.reviews_count': 1,
          'room.location': 1,
        },
      },
    );

    // Pipeline để đếm tổng số
    const countPipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'property_id',
          foreignField: '_id',
          as: 'property',
        },
      },
      {
        $lookup: {
          from: 'listings',
          localField: 'room_id',
          foreignField: '_id',
          as: 'room',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$property', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
    ];

    if (searchConditions.length > 0) {
      countPipeline.push({ $match: { $and: searchConditions } });
    }

    countPipeline.push({ $count: 'total' });

    const [data, totalResult] = await Promise.all([
      this.wishlistModel.aggregate(pipeline),
      this.wishlistModel.aggregate(countPipeline),
    ]);

    const total =
      totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return { data: data as Wishlist[], total, page, limit };
  }

  /**
   * Thống kê cho admin
   */
  async getStatistics(): Promise<{
    topRooms: Array<{ _id: string; count: number; roomInfo?: any }>;
    topUsers: Array<{ _id: string; count: number; userInfo?: any }>;
    last7Days: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Top 10 phòng được yêu thích nhiều nhất
    const topRoomsQuery: PipelineStage[] = [
      { $match: { isDelete: false } },
      { $group: { _id: '$room_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'listings',
          localField: '_id',
          foreignField: '_id',
          as: 'roomInfo',
          pipeline: [
            { $project: { title: 1, images: 1, price: 1, location: 1 } },
          ],
        },
      },
      { $unwind: { path: '$roomInfo', preserveNullAndEmptyArrays: true } },
    ];

    // Top người dùng có nhiều phòng yêu thích nhất
    const topUsersQuery: PipelineStage[] = [
      { $match: { isDelete: false } },
      { $group: { _id: '$user_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
          pipeline: [{ $project: { name: 1, email: 1, avatar: 1 } }],
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    ];

    const [topRooms, topUsers, last7DaysCount] = await Promise.all([
      this.wishlistModel.aggregate(topRoomsQuery) as Promise<
        Array<{ _id: string; count: number; roomInfo?: any }>
      >,
      this.wishlistModel.aggregate(topUsersQuery) as Promise<
        Array<{ _id: string; count: number; userInfo?: any }>
      >,
      this.wishlistModel.countDocuments({
        isDelete: false,
        created_at: { $gte: sevenDaysAgo },
      }),
    ]);

    return {
      topRooms,
      topUsers,
      last7Days: last7DaysCount,
    };
  }
}
