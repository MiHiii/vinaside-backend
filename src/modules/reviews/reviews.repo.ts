import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  SortOrder,
  Types,
} from 'mongoose';
import { Review } from './schemas/review.schema';
import { Listing } from '../listing/schemas/listing.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsRepo {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
  ) {}

  /**
   * Tạo review mới
   */
  async create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ): Promise<Review> {
    const data = {
      ...createReviewDto,
      user_id: new Types.ObjectId(userId),
      property_id: new Types.ObjectId(createReviewDto.property_id),
      room_id: new Types.ObjectId(createReviewDto.room_id),
    };

    const review = new this.reviewModel(data);
    return await review.save();
  }

  /**
   * Tìm review theo ID
   */
  async findById(
    id: string,
    populate?: PopulateOptions | Array<PopulateOptions>,
  ): Promise<Review | null> {
    const query = this.reviewModel.findById(id);

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
   * Tìm tất cả reviews theo điều kiện
   */
  async findAll(
    filter: FilterQuery<Review> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Review[]; total: number }> {
    const { sort, limit, skip, populate } = options;

    // Tạo query
    const query = this.reviewModel.find(filter);

    // Thêm sort nếu có
    if (sort) {
      query.sort(sort);
    }

    // Thêm phân trang nếu có
    if (skip !== undefined) {
      query.skip(skip);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    // Thêm populate nếu có
    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
    }

    // Thực hiện truy vấn
    const [data, total] = await Promise.all([
      query.exec(),
      this.reviewModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Tìm reviews theo room_id
   */
  async findByRoomId(
    roomId: string,
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Review[]; total: number }> {
    const filter: FilterQuery<Review> = {
      room_id: new Types.ObjectId(roomId),
    };

    return await this.findAll(filter, options);
  }

  /**
   * Tìm reviews theo user_id
   */
  async findByUserId(
    userId: string,
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Review[]; total: number }> {
    const filter: FilterQuery<Review> = {
      user_id: new Types.ObjectId(userId),
    };

    return await this.findAll(filter, options);
  }

  /**
   * Cập nhật review
   */
  async updateById(
    id: string,
    updateData: Partial<UpdateReviewDto>,
  ): Promise<Review | null> {
    return await this.reviewModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate([
        {
          path: 'user_id',
          select: 'name avatar_url email phone role is_verified customRoles',
        },
        { path: 'room_id', select: 'title images address' },
      ])
      .exec();
  }

  /**
   * Xóa cứng review
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.reviewModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Tìm kiếm reviews theo keyword
   */
  async search(
    keyword: string,
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Review[]; total: number }> {
    const filter: FilterQuery<Review> = {
      $text: { $search: keyword },
    };

    return await this.findAll(filter, options);
  }

  /**
   * Lấy thống kê reviews
   */
  async getStatistics(): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [rating: number]: number };
  }> {
    const [totalReviews, averageRating, ratingDistribution] = await Promise.all(
      [
        this.reviewModel.countDocuments(),
        this.reviewModel.aggregate([
          { $group: { _id: null, avgRating: { $avg: '$rating' } } },
        ]),
        this.reviewModel.aggregate([
          { $group: { _id: '$rating', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ],
    );

    const distributionMap: { [rating: number]: number } = {};
    for (let i = 1; i <= 5; i++) {
      distributionMap[i] = 0;
    }

    ratingDistribution.forEach((item: { _id: number; count: number }) => {
      distributionMap[item._id] = item.count;
    });

    return {
      totalReviews,
      averageRating:
        (averageRating[0] as { avgRating: number })?.avgRating || 0,
      ratingDistribution: distributionMap,
    };
  }

  /**
   * Kiểm tra user đã review room này chưa
   */
  async checkExistingReview(
    userId: string,
    roomId: string,
  ): Promise<Review | null> {
    return await this.reviewModel.findOne({
      user_id: new Types.ObjectId(userId),
      room_id: new Types.ObjectId(roomId),
    });
  }

  /**
   * Lấy thống kê rating cho một room
   */
  async getRoomRatingStats(roomId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { [rating: number]: number };
  }> {
    const [totalReviews, averageRating, ratingDistribution] = await Promise.all(
      [
        this.reviewModel.countDocuments({
          room_id: new Types.ObjectId(roomId),
        }),
        this.reviewModel.aggregate([
          { $match: { room_id: new Types.ObjectId(roomId) } },
          { $group: { _id: null, avgRating: { $avg: '$rating' } } },
        ]),
        this.reviewModel.aggregate([
          { $match: { room_id: new Types.ObjectId(roomId) } },
          { $group: { _id: '$rating', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ],
    );

    const distributionMap: { [rating: number]: number } = {};
    for (let i = 1; i <= 5; i++) {
      distributionMap[i] = 0;
    }

    ratingDistribution.forEach((item: { _id: number; count: number }) => {
      distributionMap[item._id] = item.count;
    });

    return {
      totalReviews,
      averageRating:
        (averageRating[0] as { avgRating: number })?.avgRating || 0,
      ratingDistribution: distributionMap,
    };
  }

  /**
   * Tìm reviews theo danh sách room IDs
   */
  async findByRoomIds(
    roomIds: Types.ObjectId[],
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Review[]; total: number }> {
    const filter: FilterQuery<Review> = {
      room_id: { $in: roomIds },
    };

    return await this.findAll(filter, options);
  }
}
