/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types, SortOrder, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { ListingRepo } from './listing.repo';
import { PropertyService } from '../properties/services/property.service';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Booking } from '../booking/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Wishlist } from '../wishlist/schemas/wishlist.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import {
  ListingStatistics,
  ChartDataPoint,
} from './dto/listing-statistics.dto';
import {
  getDefaultDateRange,
  determineGroupBy,
  getGroupFormat,
  generateLabels,
} from '../../utils/date.util';

export interface PaginatedListings {
  listings: Listing[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Thêm interface cho review data
export interface ListingWithReviews extends Listing {
  reviews?: any[];
  reviewsStats?: {
    total: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
  };
}

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    private readonly listingRepo: ListingRepo,
    private readonly propertyService: PropertyService,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async create(
    createListingDto: CreateListingDto,
    user: JwtPayload,
  ): Promise<Listing> {
    const { propertyId } = createListingDto;

    interface PopulatedPropertyForCreate {
      createdBy: { toString: () => string };
    }

    const property = (await this.propertyService.findOne(
      propertyId,
    )) as unknown as PopulatedPropertyForCreate;
    if (!property || !property.createdBy) {
      throw new ForbiddenException(
        'Property does not exist or does not have an owner.',
      );
    }
    // const isOwner = property.createdBy.toString() === user._id;

    // Kiểm tra quyền tạo listing:
    // - Nếu là admin: luôn được phép tạo listing cho bất kỳ property nào
    // - Nếu không phải admin: chỉ được phép tạo listing cho property mình sở hữu (createdBy === user._id)
    // if (user.role !== 'admin' && !isOwner) {
    //   throw new ForbiddenException(
    //     `You do not have permission to add listings to property ID ${propertyId}.`,
    //   );
    // }

    return this.listingRepo.create(createListingDto, user._id);
  }

  async findOne(id: string): Promise<Listing> {
    const listing = await this.listingRepo.findById(id, {
      path: 'propertyId',
      select: 'name type location ownerId staffIds',
    });
    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found.`);
    }
    return listing;
  }

  async findAll(queryDto: QueryListingDto): Promise<PaginatedListings> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      ...filters
    } = queryDto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<Listing> & {
      price_per_night?: { $gte?: number; $lte?: number };
    } = {
      isDeleted: filters.isDeleted ?? false,
    };

    if (filters.propertyId) {
      query.propertyId = new Types.ObjectId(filters.propertyId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.cancel_policy) {
      query.cancel_policy = filters.cancel_policy;
    }
    if (filters.priceFrom !== undefined || filters.priceTo !== undefined) {
      query.price_per_night = {
        ...(filters.priceFrom !== undefined && { $gte: filters.priceFrom }),
        ...(filters.priceTo !== undefined && { $lte: filters.priceTo }),
      };
    }
    if (filters.is_verified !== undefined) {
      query.is_verified = filters.is_verified;
    }

    // Filter theo title (nếu có trường này)
    if (filters.title && typeof filters.title === 'string') {
      const titleStr = String(filters.title);
      if (titleStr.trim()) {
        query.title = { $regex: titleStr, $options: 'i' };
      }
    }

    // Tìm kiếm gần đúng theo keyword cho cả title và description
    if (filters.keyword && typeof filters.keyword === 'string') {
      const keywordStr = String(filters.keyword);
      query.$or = [
        { title: { $regex: keywordStr, $options: 'i' } },
        { description: { $regex: keywordStr, $options: 'i' } },
      ];
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchStr = String(filters.search);
      query.title = { $regex: searchStr, $options: 'i' };
    }

    // Filter theo view count
    if (
      filters.minViewCount !== undefined ||
      filters.maxViewCount !== undefined
    ) {
      query.viewCount = {
        ...(filters.minViewCount !== undefined && {
          $gte: filters.minViewCount,
        }),
        ...(filters.maxViewCount !== undefined && {
          $lte: filters.maxViewCount,
        }),
      };
    }

    const sort: Record<string, SortOrder> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const result = await this.listingRepo.findAll(query, {
      sort,
      skip,
      limit,
      populate: { path: 'propertyId', select: 'name type' },
    });

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / (limit || 1)),
      },
    };
  }

  async update(
    id: string,
    updateListingDto: UpdateListingDto,
    user: JwtPayload,
  ): Promise<Listing> {
    const updatedListing = await this.listingRepo.updateById(
      id,
      updateListingDto,
      user._id,
    );
    if (!updatedListing) {
      throw new NotFoundException(`Could not update listing with ID ${id}.`);
    }
    return updatedListing;
  }

  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
    await this.listingRepo.softDelete(id, user._id);
    return { success: true };
  }

  async restore(id: string): Promise<Listing> {
    const restoredListing = await this.listingRepo.restore(id);
    if (!restoredListing) {
      throw new NotFoundException(`Could not restore listing with ID ${id}.`);
    }
    return restoredListing;
  }

  async updateStatus(
    id: string,
    status: ListingStatus,
    user: JwtPayload,
  ): Promise<Listing> {
    const updatedListing = await this.listingRepo.updateStatus(
      id,
      status,
      user._id,
    );
    if (!updatedListing) {
      throw new NotFoundException(
        `Could not update status for listing with ID ${id}.`,
      );
    }
    return updatedListing;
  }

  // =========================== REVIEW INTEGRATION METHODS ===========================

  /**
   * Lấy listing kèm theo reviews
   */
  async findOneWithReviews(
    id: string,
    options?: {
      includeReviews?: boolean;
      reviewsLimit?: number;
      reviewsPage?: number;
    },
  ): Promise<ListingWithReviews> {
    const {
      includeReviews = true,
      reviewsLimit = 10,
      reviewsPage = 1,
    } = options || {};

    // Lấy thông tin listing
    const listing = await this.findOne(id);

    if (!includeReviews) {
      return listing as ListingWithReviews;
    }

    // Import động để tránh circular dependency
    const mongoose = await import('mongoose');
    const ReviewModel = mongoose.model('Review');

    // Lấy reviews với pagination
    const skip = (reviewsPage - 1) * reviewsLimit;
    const reviews = await (ReviewModel.find({ room_id: id }) as any)
      .populate('user_id', 'name avatar email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(reviewsLimit)
      .lean();

    // Lấy thống kê reviews
    const reviewsStats = await this.getListingReviewsStats(id);

    return {
      ...listing.toObject(),
      reviews,
      reviewsStats,
    } as ListingWithReviews;
  }

  /**
   * Lấy thống kê reviews của một listing
   */
  async getListingReviewsStats(listingId: string) {
    const mongoose = await import('mongoose');
    const ReviewModel = mongoose.model('Review');

    const stats = await ReviewModel.aggregate([
      { $match: { room_id: new Types.ObjectId(listingId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingDistribution: { $push: '$rating' },
        },
      },
    ]);

    if (!stats.length) {
      return {
        total: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const { total, averageRating, ratingDistribution } = stats[0] as {
      total: number;
      averageRating: number;
      ratingDistribution: number[];
    };

    // Tính phân bố rating
    const ratingDistributionResult: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    ratingDistribution.forEach((rating: number) => {
      ratingDistributionResult[rating]++;
    });

    return {
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: ratingDistributionResult,
    };
  }

  /**
   * Tính lại rating cho tất cả listings (sử dụng khi cần đồng bộ dữ liệu)
   */
  async recalculateAllRatings(): Promise<{ updated: number }> {
    const mongoose = await import('mongoose');
    const ReviewModel = mongoose.model('Review');

    this.logger.log('Starting to recalculate all listing ratings...');

    // Lấy tất cả listing IDs
    const listingIds = await this.listingRepo.findAll(
      { isDeleted: false },
      { limit: 0 }, // Không giới hạn số lượng
    );

    let updatedCount = 0;

    for (const listing of listingIds.data) {
      try {
        // Tính toán rating cho từng listing
        const stats = await ReviewModel.aggregate([
          { $match: { room_id: (listing as Listing)._id } },
          {
            $group: {
              _id: '$room_id',
              averageRating: { $avg: '$rating' },
              reviewsCount: { $sum: 1 },
            },
          },
        ]);

        const { averageRating = 0, reviewsCount = 0 } =
          (stats[0] as {
            averageRating?: number;
            reviewsCount?: number;
          }) || {};

        // Cập nhật listing trực tiếp qua model
        const mongoose = await import('mongoose');
        await (mongoose
          .model('Listing')
          .findByIdAndUpdate((listing as Listing)._id, {
            average_rating: Math.round(averageRating * 10) / 10,
            reviews_count: reviewsCount,
          }) as any);

        updatedCount++;
      } catch (error) {
        this.logger.error(
          `Error updating rating for listing ${String(listing._id)}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Completed recalculating ratings for ${updatedCount} listings`,
    );
    return { updated: updatedCount };
  }

  /**
   * Lấy top listings theo rating
   */
  async getTopRatedListings(limit: number = 10): Promise<Listing[]> {
    const result = await this.listingRepo.findAll(
      {
        isDeleted: false,
        status: ListingStatus.ACTIVE,
        reviews_count: { $gte: 1 }, // Chỉ lấy những listing có ít nhất 1 review
      },
      {
        sort: { average_rating: -1, reviews_count: -1 },
        limit,
        populate: { path: 'propertyId', select: 'name type location' },
      },
    );

    return result.data;
  }

  /**
   * Lấy top listings theo số lượt xem
   */
  async getTopViewedListings(limit: number = 10): Promise<Listing[]> {
    const result = await this.listingRepo.findAll(
      {
        isDeleted: false,
        status: ListingStatus.ACTIVE,
        viewCount: { $gte: 1 }, // Chỉ lấy những listing có ít nhất 1 lượt xem
      },
      {
        sort: { viewCount: -1 },
        limit,
        populate: { path: 'propertyId', select: 'name type location' },
      },
    );

    return result.data;
  }

  /**
   * Tìm listings theo khoảng rating
   */
  async findByRatingRange(
    minRating: number = 0,
    maxRating: number = 5,
    queryDto: QueryListingDto = {},
  ): Promise<PaginatedListings> {
    const { page = 1, limit = 10 } = queryDto;

    const query: FilterQuery<Listing> = {
      isDeleted: false,
      average_rating: { $gte: minRating, $lte: maxRating },
    };

    // Thêm các filter khác từ queryDto
    if (queryDto.status) query.status = queryDto.status;
    if (queryDto.propertyId)
      query.propertyId = new Types.ObjectId(queryDto.propertyId);

    const result = await this.listingRepo.findAll(query, {
      sort: { average_rating: -1, reviews_count: -1 },
      skip: (page - 1) * limit,
      limit,
      populate: { path: 'propertyId', select: 'name type location' },
    });

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  /**
   * Tăng số lượt xem của listing
   */
  async incrementViewCount(id: string): Promise<void> {
    try {
      await this.listingRepo.incrementViewCount(id);
      this.logger.debug(`Incremented view count for listing ${id}`);
    } catch (error) {
      this.logger.error(
        `Error incrementing view count for listing ${id}: ${(error as Error).message}`,
      );
      // Không throw error để không ảnh hưởng đến việc xem listing
    }
  }

  /**
   * Lấy listing và tăng view count
   */
  async findOneAndIncrementView(id: string): Promise<Listing> {
    const listing = await this.findOne(id);
    // Tăng view count bất đồng bộ để không làm chậm response
    this.incrementViewCount(id).catch((error) => {
      this.logger.error(
        `Failed to increment view count for listing ${id}: ${(error as Error).message}`,
      );
    });
    return listing;
  }

  /**
   * Lấy thống kê chi tiết cho một listing
   */
  async getListingStatistics(
    listingId: string,
    startDate?: Date,
    endDate?: Date,
    groupBy?: string,
  ): Promise<ListingStatistics & { chartData: ChartDataPoint[] }> {
    const { Types } = await import('mongoose');
    const listingIdObj = new Types.ObjectId(listingId);

    // Sử dụng 7 ngày gần nhất nếu không có ngày được chỉ định
    let actualStartDate = startDate;
    let actualEndDate = endDate;
    if (!startDate && !endDate) {
      const defaultRange = getDefaultDateRange();
      actualStartDate = defaultRange.startDate;
      actualEndDate = defaultRange.endDate;
    }

    const finalGroupBy = determineGroupBy(
      actualStartDate!,
      actualEndDate!,
      groupBy,
    );
    const { format: groupFormat, labelFn } = getGroupFormat(finalGroupBy);

    // Lấy dữ liệu cho biểu đồ
    const chartMatch: any = {
      listingId: listingIdObj,
      isDeleted: false,
      status: { $in: ['confirmed', 'completed'] },
    };
    if (actualStartDate || actualEndDate) {
      chartMatch.created_at = {};
      if (actualStartDate) chartMatch.created_at.$gte = actualStartDate;
      if (actualEndDate) chartMatch.created_at.$lte = actualEndDate;
    }

    const chartDataAgg = await this.bookingModel.aggregate([
      { $match: chartMatch },
      {
        $group: {
          _id: {
            group: {
              $dateToString: { format: groupFormat, date: '$created_at' },
            },
          },
          revenue: { $sum: '$final_amount' },
          bookings: { $sum: 1 },
          nights: { $sum: '$nights' },
        },
      },
      { $sort: { '_id.group': 1 } },
    ]);

    // Chuẩn hóa dữ liệu cho biểu đồ
    const labelMap = new Map<
      string,
      { revenue: number; bookings: number; nights: number }
    >();
    chartDataAgg.forEach((item) => {
      labelMap.set(item._id.group, {
        revenue: item.revenue,
        bookings: item.bookings,
        nights: item.nights,
      });
    });

    const labels = generateLabels(
      actualStartDate!,
      actualEndDate!,
      finalGroupBy,
    );
    const chartData: ChartDataPoint[] = labels.map((label) => {
      const data = labelMap.get(label) || {
        revenue: 0,
        bookings: 0,
        nights: 0,
      };
      return {
        label: labelFn(label),
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: data.nights > 0 ? 100 : 0,
      };
    });

    // Lấy thông tin listing
    const listing = await this.findOne(listingId);
    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found.`);
    }

    // Sử dụng cùng khoảng thời gian cho thống kê chính
    const dateFilter: any = {};
    if (actualStartDate || actualEndDate) {
      dateFilter.created_at = {};
      if (actualStartDate) dateFilter.created_at.$gte = actualStartDate;
      if (actualEndDate) dateFilter.created_at.$lte = actualEndDate;
    }

    // 1. Thống kê booking
    const bookingStats = await this.bookingModel.aggregate([
      {
        $match: {
          listingId: listingIdObj,
          isDeleted: false,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$final_amount' },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
        },
      },
    ]);

    // 2. Tính tỉ lệ lấp đầy và doanh thu theo khoảng thời gian được chọn
    let occupancyRate = 0;
    let revenueAmount = 0;

    if (actualStartDate && actualEndDate) {
      const totalDays =
        Math.ceil(
          (actualEndDate.getTime() - actualStartDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;

      const periodBookings = await this.bookingModel.aggregate([
        {
          $match: {
            listingId: listingIdObj,
            isDeleted: false,
            created_at: { $gte: actualStartDate, $lte: actualEndDate },
            status: { $in: ['confirmed', 'completed'] },
          },
        },
        {
          $group: {
            _id: null,
            totalNights: { $sum: '$nights' },
            totalRevenue: { $sum: '$final_amount' },
          },
        },
      ]);

      if (periodBookings.length > 0) {
        const periodBooking = periodBookings[0];
        occupancyRate = Math.round(
          (periodBooking.totalNights / totalDays) * 100,
        );
        revenueAmount = periodBooking.totalRevenue;
      }
    }

    // 3. Thống kê khách quay lại
    const returningGuests = await this.bookingModel.aggregate([
      {
        $match: {
          listingId: listingIdObj,
          isDeleted: false,
          status: { $in: ['confirmed', 'completed'] },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$guestId',
          bookingCount: { $sum: 1 },
        },
      },
      {
        $match: {
          bookingCount: { $gt: 1 },
        },
      },
      {
        $count: 'returningGuests',
      },
    ]);

    // 4. Thống kê đánh giá
    const reviewStats = await this.reviewModel.aggregate([
      {
        $match: {
          room_id: listingIdObj,
          isDeleted: false,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    // 5. Thống kê wishlist
    const wishlistCount = await this.wishlistModel.countDocuments({
      room_id: listingIdObj,
      isDelete: false,
      ...dateFilter,
    });

    // 6. Thống kê voucher
    const voucherStats = await this.transactionModel.aggregate([
      {
        $match: {
          reference_type: 'booking',
          'metadata.listingId': listingId,
          'metadata.voucherCode': { $exists: true, $ne: null },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$metadata.voucherCode',
          totalDiscount: { $sum: '$amount' },
          usageCount: { $sum: 1 },
        },
      },
      {
        $sort: { usageCount: -1 },
      },
    ]);

    // Tính tổng tiền giảm giá và voucher phổ biến nhất
    const totalDiscountAmount = voucherStats.reduce(
      (sum, voucher) => sum + voucher.totalDiscount,
      0,
    );
    const mostPopularVoucher =
      voucherStats.length > 0 ? voucherStats[0]._id : 'N/A';

    // Tính toán các chỉ số
    const bookingData = bookingStats[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      cancelledBookings: 0,
      confirmedBookings: 0,
    };

    const reviewData = reviewStats[0] || {
      totalReviews: listing.reviews_count ?? 0,
      averageRating: listing.average_rating ?? 0,
    };
    const returningGuestsCount = returningGuests[0]?.returningGuests || 0;

    return {
      listingId: listingId,
      listingTitle: listing.title,
      businessPerformance: {
        totalBookings: bookingData.totalBookings,
        occupancyRate,
        monthlyRevenue: revenueAmount, // Đổi tên từ monthlyRevenueAmount thành revenueAmount
        cancellationRate:
          bookingData.totalBookings > 0
            ? Math.round(
                (bookingData.cancelledBookings / bookingData.totalBookings) *
                  100,
              )
            : 0,
        returningGuests: returningGuestsCount,
      },
      reviews: {
        averageRating: reviewData.averageRating
          ? Math.round(reviewData.averageRating * 10) / 10
          : 0,
        totalReviews: reviewData.totalReviews || 0,
      },
      engagement: {
        viewCount: listing.viewCount || 0,
        wishlistCount,
      },
      voucherImpact: {
        totalDiscountAmount,
        mostPopularVoucher,
      },
      chartData,
    };
  }

  /**
   * Lấy thống kê cho tất cả listings của một property
   */
  async getPropertyListingsStatistics(
    propertyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ListingStatistics[]> {
    const { Types } = await import('mongoose');
    const propertyIdObj = new Types.ObjectId(propertyId);

    // Lấy tất cả listings của property
    const listings = await this.listingRepo.findAll(
      { propertyId: propertyIdObj, isDeleted: false },
      { limit: 0 },
    );

    const statistics: ListingStatistics[] = [];

    for (const listing of listings.data) {
      try {
        const listingStats = await this.getListingStatistics(
          String(listing._id),
          startDate,
          endDate,
        );
        statistics.push(listingStats);
      } catch (error) {
        this.logger.error(
          `Error getting statistics for listing ${String(listing._id)}: ${(error as Error).message}`,
        );
      }
    }

    return statistics;
  }
}
