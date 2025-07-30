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
import { Property } from '../properties/schemas/property.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Booking } from '../booking/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Wishlist } from '../wishlist/schemas/wishlist.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { Service } from '../services/schemas/service.schema';

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
import { GooglePlacesService } from '../location/google-places.service';
import { applyStaffFilter } from '../../utils/staff-filter.util';

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
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Service.name) private readonly serviceModel: Model<Service>,
    private readonly googlePlacesService: GooglePlacesService,
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

    return this.listingRepo.create(createListingDto, user._id);
  }

  async findOne(id: string): Promise<Listing> {
    const listing = await this.listingRepo.findById(id, {
      path: 'propertyId',
      select: 'name type location',
    });
    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found.`);
    }
    return listing;
  }

  async findAll(
    queryDto: QueryListingDto,
    user?: JwtPayload,
    request?: any,
  ): Promise<{
    listings: any[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 14,
      sortBy = 'created_at',
      sortOrder = 'desc',
      ...filters
    } = queryDto;

    const skip = (page - 1) * limit;

    // First, handle location-based filtering by finding matching properties
    let propertyIds: Types.ObjectId[] | undefined;

    const hasLocationFilter = !!(
      filters.place_id ||
      filters.city ||
      filters.district ||
      filters.ward ||
      filters.address ||
      filters.locationKeyword ||
      (filters.lat && filters.lng)
    );

    if (hasLocationFilter) {
      propertyIds = await this.findPropertiesByLocation(filters);

      // If no properties match location criteria, return empty result
      if (propertyIds && propertyIds.length === 0) {
        return {
          listings: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
    }

    const query: FilterQuery<Listing> & {
      price_per_night?: { $gte?: number; $lte?: number };
    } = {
      isDeleted: filters.isDeleted ?? false,
    };

    // Apply staff filtering using utility function
    const filteredQuery = applyStaffFilter(query, request, 'propertyId');

    // Apply property filter if we have location-based property IDs
    if (propertyIds) {
      filteredQuery.propertyId = { $in: propertyIds };
    } else if (filters.propertyId) {
      filteredQuery.propertyId = new Types.ObjectId(filters.propertyId);
    }

    if (filters.status) {
      filteredQuery.status = filters.status;
    }
    if (filters.cancel_policy) {
      filteredQuery.cancel_policy = filters.cancel_policy;
    }
    if (filters.priceFrom !== undefined || filters.priceTo !== undefined) {
      filteredQuery.price_per_night = {
        ...(filters.priceFrom !== undefined && { $gte: filters.priceFrom }),
        ...(filters.priceTo !== undefined && { $lte: filters.priceTo }),
      };
    }
    if (filters.is_verified !== undefined) {
      filteredQuery.is_verified = filters.is_verified;
    }

    // Filter theo title (nếu có trường này)
    if (filters.title && typeof filters.title === 'string') {
      const titleStr = String(filters.title);
      if (titleStr.trim()) {
        filteredQuery.title = { $regex: titleStr, $options: 'i' };
      }
    }

    // Tìm kiếm gần đúng theo keyword cho cả title và description
    if (filters.keyword && typeof filters.keyword === 'string') {
      const keywordStr = String(filters.keyword);
      filteredQuery.$or = [
        { title: { $regex: keywordStr, $options: 'i' } },
        { description: { $regex: keywordStr, $options: 'i' } },
      ];
    }

    if (filters.search && typeof filters.search === 'string') {
      const searchStr = String(filters.search);
      filteredQuery.title = { $regex: searchStr, $options: 'i' };
    }

    // Filter theo view count
    if (
      filters.minViewCount !== undefined ||
      filters.maxViewCount !== undefined
    ) {
      filteredQuery.viewCount = {
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

    const result = await this.listingRepo.findAll(filteredQuery, {
      sort,
      skip,
      limit,
      populate: { path: 'propertyId', select: 'name type location' },
    });

    // Nếu có user, lấy danh sách room_id đã wishlist
    let wishlistRoomIds: string[] = [];
    if (user?._id) {
      try {
        // Sử dụng model đã được inject
        const wishlistIds = await this.wishlistModel
          .find({
            user_id: user._id,
            isDelete: false,
          })
          .distinct('room_id');
        wishlistRoomIds = (wishlistIds as unknown as any[]).map((id) =>
          String(id),
        );
      } catch (error) {
        this.logger.warn('Error fetching wishlist data:', error);
        wishlistRoomIds = [];
      }
    }

    // Thêm trường is_wishlisted cho từng listing
    const listingsWithWishlist = result.data.map((listing) => {
      const obj = listing.toObject ? listing.toObject() : listing;
      return {
        ...obj,
        is_wishlisted: wishlistRoomIds.includes(
          String((obj as { _id: string | Types.ObjectId })._id),
        ),
      };
    });

    return {
      listings: listingsWithWishlist,
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
    const reviews = await ReviewModel.find({ room_id: id })
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
      let chartOccupancyRate = data.nights > 0 ? 100 : 0;
      if (chartOccupancyRate > 100) chartOccupancyRate = 100;
      return {
        label: labelFn(label),
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: chartOccupancyRate,
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
        if (occupancyRate > 100) occupancyRate = 100;
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

  /**
   * Helper methods for location-based filtering
   */

  /**
   * Check if query has any location filters
   */
  private hasLocationFilters(filters: any): boolean {
    return !!(
      filters.place_id ||
      filters.city ||
      filters.district ||
      filters.ward ||
      filters.address ||
      filters.locationKeyword ||
      (filters.lat && filters.lng)
    );
  }

  /**
   * Find properties matching location criteria with priority order
   */
  private async findPropertiesByLocation(
    filters: any,
  ): Promise<Types.ObjectId[]> {
    // Priority 1: Google Places ID (most precise)
    if (filters.place_id) {
      // First try exact match
      const exactMatch = await this.findPropertiesByExactPlaceId(
        filters.place_id,
      );
      if (exactMatch.length > 0) {
        return exactMatch;
      }

      // If no exact match and fuzzy search is enabled (default: true), try fuzzy search
      const enableFuzzy = filters.fuzzy_place_search !== false; // Default to true

      if (enableFuzzy) {
        const fuzzyMatch = await this.findPropertiesByFuzzyPlaceId(
          filters.place_id,
        );
        if (fuzzyMatch.length > 0) {
          return fuzzyMatch;
        }

        // If no fuzzy match found, try searching by province/city from place_id
        const provinceMatch = await this.findPropertiesByPlaceIdProvince(
          filters.place_id,
        );
        if (provinceMatch.length > 0) {
          return provinceMatch;
        }
      }
    }

    // Priority 2: City + District + Ward combination
    if (filters.city || filters.district || filters.ward) {
      const locationQuery: FilterQuery<Property> = { isDeleted: false };

      if (filters.city) {
        locationQuery['location.city'] = new RegExp(filters.city, 'i');
      }
      if (filters.district) {
        locationQuery['location.district'] = new RegExp(filters.district, 'i');
      }
      if (filters.ward) {
        locationQuery['location.ward'] = new RegExp(filters.ward, 'i');
      }

      try {
        const properties = await this.propertyModel
          .find(locationQuery, { _id: 1 })
          .lean()
          .exec();

        if (properties.length > 0) {
          return properties.map((property) => property._id);
        }
      } catch (error) {
        this.logger.error(
          `Error finding properties by city/district/ward: ${(error as Error).message}`,
        );
      }
    }

    // Priority 3: Address + Location keyword + Geospatial search
    const propertyQuery: FilterQuery<Property> = { isDeleted: false };

    if (filters.address) {
      propertyQuery['location.address'] = new RegExp(filters.address, 'i');
    }

    // Location keyword search (across all location fields)
    if (filters.locationKeyword) {
      const keyword = filters.locationKeyword;
      propertyQuery.$or = [
        { 'location.address': { $regex: keyword, $options: 'i' } },
        { 'location.city': { $regex: keyword, $options: 'i' } },
        { 'location.district': { $regex: keyword, $options: 'i' } },
        { 'location.ward': { $regex: keyword, $options: 'i' } },
      ];
    }

    // Geospatial search (nearby)
    if (filters.lat && filters.lng) {
      const lat = parseFloat(filters.lat);
      const lng = parseFloat(filters.lng);
      const radius = parseFloat(filters.radius) || 10; // Default 10km

      // Convert radius from km to degrees (approximate)
      const latRange = radius / 111; // 1 degree lat ≈ 111km
      const lngRange = radius / (111 * Math.cos((lat * Math.PI) / 180));

      propertyQuery['location.lat'] = {
        $gte: lat - latRange,
        $lte: lat + latRange,
      };
      propertyQuery['location.lng'] = {
        $gte: lng - lngRange,
        $lte: lng + lngRange,
      };
    }

    try {
      const properties = await this.propertyModel
        .find(propertyQuery, { _id: 1 })
        .lean()
        .exec();

      return properties.map((property) => property._id);
    } catch (error) {
      this.logger.error(
        `Error finding properties by location: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Find properties by exact place_id match
   */
  private async findPropertiesByExactPlaceId(
    placeId: string,
  ): Promise<Types.ObjectId[]> {
    try {
      const properties = await this.propertyModel
        .find(
          {
            isDeleted: false,
            'location.place_id': placeId,
          },
          { _id: 1 },
        )
        .lean()
        .exec();

      return properties.map((property) => property._id);
    } catch (error) {
      this.logger.error(
        `Error finding properties by exact place_id: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Find properties by fuzzy place_id search using Google Places API
   */
  private async findPropertiesByFuzzyPlaceId(
    placeId: string,
  ): Promise<Types.ObjectId[]> {
    try {
      // Get place details from Google Places
      const placeDetails =
        await this.googlePlacesService.getPlaceDetails(placeId);
      if (!placeDetails || !placeDetails.geometry) {
        this.logger.warn(`❌ No place details found for place_id: ${placeId}`);
        return [];
      }

      const { lat, lng } = placeDetails.geometry.location;
      const searchRadius = 2; // 2km radius for fuzzy search

      // Convert radius from km to degrees (approximate)
      const latRange = searchRadius / 111;
      const lngRange = searchRadius / (111 * Math.cos((lat * Math.PI) / 180));

      const properties = await this.propertyModel
        .find(
          {
            isDeleted: false,
            'location.lat': {
              $gte: lat - latRange,
              $lte: lat + latRange,
            },
            'location.lng': {
              $gte: lng - lngRange,
              $lte: lng + lngRange,
            },
          },
          { _id: 1, 'location.city': 1, 'location.district': 1 },
        )
        .lean()
        .exec();

      return properties.map((property) => property._id);
    } catch (error) {
      this.logger.error(
        `❌ Error in fuzzy place_id search: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Find properties by province/city from place_id
   */
  private async findPropertiesByPlaceIdProvince(
    placeId: string,
  ): Promise<Types.ObjectId[]> {
    try {
      // Get place details from Google Places
      const placeDetails =
        await this.googlePlacesService.getPlaceDetails(placeId);
      if (!placeDetails || !placeDetails.description) {
        this.logger.warn(`❌ No place details found for place_id: ${placeId}`);
        return [];
      }

      const placeAddress = placeDetails.description;
      const province = this.extractProvinceFromAddress(placeAddress);

      if (!province) {
        return [];
      }

      // Search by province/city
      const properties = await this.propertyModel
        .find(
          {
            isDeleted: false,
            $or: [
              { 'location.city': { $regex: province, $options: 'i' } },
              { 'location.district': { $regex: province, $options: 'i' } },
              { 'location.ward': { $regex: province, $options: 'i' } },
            ],
          },
          { _id: 1, 'location.city': 1, 'location.district': 1 },
        )
        .lean()
        .exec();

      return properties.map((property) => property._id);
    } catch (error) {
      this.logger.error(
        `❌ Error in province search: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Extract province/city name from address string
   */
  private extractProvinceFromAddress(address: string): string {
    // Common Vietnamese provinces/cities patterns (both Vietnamese and English)
    const provincePatterns = [
      { vi: 'Hà Nội', en: 'Hanoi' },
      { vi: 'Hồ Chí Minh', en: 'Ho Chi Minh' },
      { vi: 'Đà Nẵng', en: 'Da Nang' },
      { vi: 'Hải Phòng', en: 'Hai Phong' },
      { vi: 'Cần Thơ', en: 'Can Tho' },
      { vi: 'Huế', en: 'Hue' },
      { vi: 'Nha Trang', en: 'Nha Trang' },
      { vi: 'Đà Lạt', en: 'Da Lat' },
      { vi: 'Vũng Tàu', en: 'Vung Tau' },
      { vi: 'Quy Nhơn', en: 'Quy Nhon' },
      { vi: 'Hải Dương', en: 'Hai Duong' },
      { vi: 'Bắc Ninh', en: 'Bac Ninh' },
      { vi: 'Thái Nguyên', en: 'Thai Nguyen' },
      { vi: 'Lào Cai', en: 'Lao Cai' },
      { vi: 'Sơn La', en: 'Son La' },
      { vi: 'Yên Bái', en: 'Yen Bai' },
      { vi: 'Tuyên Quang', en: 'Tuyen Quang' },
      { vi: 'Phú Thọ', en: 'Phu Tho' },
      { vi: 'Vĩnh Phúc', en: 'Vinh Phuc' },
      { vi: 'Quảng Ninh', en: 'Quang Ninh' },
      { vi: 'Bắc Giang', en: 'Bac Giang' },
      { vi: 'Bắc Kạn', en: 'Bac Kan' },
      { vi: 'Cao Bằng', en: 'Cao Bang' },
      { vi: 'Lạng Sơn', en: 'Lang Son' },
      { vi: 'Thái Bình', en: 'Thai Binh' },
      { vi: 'Nam Định', en: 'Nam Dinh' },
      { vi: 'Ninh Bình', en: 'Ninh Binh' },
      { vi: 'Thanh Hóa', en: 'Thanh Hoa' },
      { vi: 'Nghệ An', en: 'Nghe An' },
      { vi: 'Hà Tĩnh', en: 'Ha Tinh' },
      { vi: 'Quảng Bình', en: 'Quang Binh' },
      { vi: 'Quảng Trị', en: 'Quang Tri' },
      { vi: 'Thừa Thiên Huế', en: 'Thua Thien Hue' },
      { vi: 'Quảng Nam', en: 'Quang Nam' },
      { vi: 'Quảng Ngãi', en: 'Quang Ngai' },
      { vi: 'Bình Định', en: 'Binh Dinh' },
      { vi: 'Phú Yên', en: 'Phu Yen' },
      { vi: 'Khánh Hòa', en: 'Khanh Hoa' },
      { vi: 'Ninh Thuận', en: 'Ninh Thuan' },
      { vi: 'Bình Thuận', en: 'Binh Thuan' },
      { vi: 'Kon Tum', en: 'Kon Tum' },
      { vi: 'Gia Lai', en: 'Gia Lai' },
      { vi: 'Đắk Lắk', en: 'Dak Lak' },
      { vi: 'Đắk Nông', en: 'Dak Nong' },
      { vi: 'Lâm Đồng', en: 'Lam Dong' },
      { vi: 'Bình Phước', en: 'Binh Phuoc' },
      { vi: 'Tây Ninh', en: 'Tay Ninh' },
      { vi: 'Bình Dương', en: 'Binh Duong' },
      { vi: 'Đồng Nai', en: 'Dong Nai' },
      { vi: 'Bà Rịa - Vũng Tàu', en: 'Ba Ria Vung Tau' },
      { vi: 'Long An', en: 'Long An' },
      { vi: 'Tiền Giang', en: 'Tien Giang' },
      { vi: 'Bến Tre', en: 'Ben Tre' },
      { vi: 'Trà Vinh', en: 'Tra Vinh' },
      { vi: 'Vĩnh Long', en: 'Vinh Long' },
      { vi: 'Đồng Tháp', en: 'Dong Thap' },
      { vi: 'An Giang', en: 'An Giang' },
      { vi: 'Kiên Giang', en: 'Kien Giang' },
      { vi: 'Cà Mau', en: 'Ca Mau' },
      { vi: 'Bạc Liêu', en: 'Bac Lieu' },
      { vi: 'Sóc Trăng', en: 'Soc Trang' },
      { vi: 'Hậu Giang', en: 'Hau Giang' },
    ];

    for (const pattern of provincePatterns) {
      // Check both Vietnamese and English versions
      if (address.includes(pattern.vi) || address.includes(pattern.en)) {
        return pattern.vi; // Return Vietnamese version for consistency
      }
    }

    return '';
  }

  /**
   * Advanced location search with distance calculation
   */
  async findListingsByLocation(
    lat: number,
    lng: number,
    radius: number = 10,
    queryDto: QueryListingDto = {},
  ): Promise<{
    listings: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Use MongoDB's $geoNear for more precise distance calculation
    // First, get properties within radius with actual distance
    const nearbyProperties = await this.propertyModel.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON uses [lng, lat] order
          },
          distanceField: 'distance',
          maxDistance: radius * 1000, // Convert km to meters
          spherical: true,
          query: { isDeleted: false },
        },
      },
      {
        $project: {
          _id: 1,
          distance: { $divide: ['$distance', 1000] }, // Convert back to km
        },
      },
    ]);

    if (nearbyProperties.length === 0) {
      return {
        listings: [],
        meta: {
          total: 0,
          page: queryDto.page || 1,
          limit: queryDto.limit || 14,
          totalPages: 0,
        },
      };
    }

    // Create a map of property ID to distance
    const distanceMap = new Map<string, number>();
    const propertyIds = nearbyProperties.map(
      (prop: { _id: any; distance: number }) => {
        distanceMap.set(String(prop._id), prop.distance);
        return prop._id;
      },
    );

    const { page = 1, limit = 14 } = queryDto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<Listing> = {
      isDeleted: queryDto.isDeleted ?? false,
      propertyId: { $in: propertyIds },
    };

    // Apply other filters
    if (queryDto.status) query.status = queryDto.status;
    if (queryDto.cancel_policy) query.cancel_policy = queryDto.cancel_policy;
    if (queryDto.priceFrom !== undefined || queryDto.priceTo !== undefined) {
      query.price_per_night = {
        ...(queryDto.priceFrom !== undefined && { $gte: queryDto.priceFrom }),
        ...(queryDto.priceTo !== undefined && { $lte: queryDto.priceTo }),
      };
    }

    const sort: Record<string, SortOrder> = {
      [queryDto.sortBy || 'created_at']: queryDto.sortOrder === 'asc' ? 1 : -1,
    };

    const result = await this.listingRepo.findAll(query, {
      sort,
      skip,
      limit,
      populate: { path: 'propertyId', select: 'name type location' },
    });

    // Add distance to each listing
    const listingsWithDistance = result.data.map((listing) => ({
      ...listing.toObject(),
      distance: distanceMap.get(listing.propertyId._id.toString()),
    }));

    return {
      listings: listingsWithDistance,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / (limit || 1)),
      },
    };
  }
}
