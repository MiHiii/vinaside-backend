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
  ListingStatisticsDto,
  ListingStatisticsResponseDto,
  ListingChartDataPoint,
  DateRangeType,
  ListingVoucherDetail,
  ListingServiceDetail,
} from './dto/listing-statistics.dto';
// Removed unused date utility imports
import { GooglePlacesService } from '../location/google-places.service';
import {
  applyStaffFilter,
  hasPropertyAccess,
} from '../../utils/staff-filter.util';
import { PropertyStaffAssignmentService } from '../property-staff-assignment/property-staff-assignment.service';

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
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
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

    // Chỉ cho phép khách hàng xem listing có trạng thái active
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException(`Listing with ID ${id} not found.`);
    }

    return listing;
  }

  async findOneForStaff(id: string): Promise<Listing> {
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
      limit = 20, // Use same default as DTO
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

    // Chỉ cho phép khách hàng xem listing có trạng thái active
    // Staff có thể xem tất cả trạng thái thông qua staff filter
    if (
      !request ||
      !request.user ||
      (request.user.role !== 'admin' && request.user.role !== 'staff')
    ) {
      query.status = ListingStatus.ACTIVE;
    }

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

    // =================== DATE-BASED FILTERING ===================

    // Xử lý tìm kiếm theo ngày nhận phòng/trả phòng
    if (filters.checkInDate || filters.checkOutDate) {
      // Nếu có ngày nhận phòng hoặc trả phòng, cần kiểm tra availability
      if (filters.checkAvailability !== false) {
        // Lấy danh sách listing IDs có sẵn trong khoảng thời gian này
        const availableListingIds = await this.getAvailableListingIds(
          filters.checkInDate,
          filters.checkOutDate,
          filters.guests,
          filters.minNights,
          filters.maxNights,
        );

        // Nếu không có listing nào khả dụng, trả về kết quả rỗng
        if (availableListingIds.length === 0) {
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

        // Thêm filter cho listing IDs có sẵn
        filteredQuery._id = { $in: availableListingIds };
      }
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
        totalPages: Math.ceil(result.total / limit),
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
        status: ListingStatus.ACTIVE, // Chỉ trả về listing active
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
        status: ListingStatus.ACTIVE, // Chỉ trả về listing active
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
   * Lấy top listings theo số lượt yêu thích (wishlist count)
   */
  async getTopWishlistListings(limit: number = 10): Promise<any[]> {
    try {
      // Sử dụng aggregation để đếm số wishlist cho mỗi room
      const wishlistCounts = await this.wishlistModel.aggregate([
        {
          $match: {
            isDelete: false,
          },
        },
        {
          $group: {
            _id: '$room_id',
            wishlistCount: { $sum: 1 },
          },
        },
        {
          $sort: { wishlistCount: -1 },
        },
        {
          $limit: limit,
        },
      ]);

      if (wishlistCounts.length === 0) {
        // Nếu không có wishlist nào, trả về top listings theo rating thay thế
        this.logger.log(
          'No wishlists found, returning top rated listings instead',
        );
        return this.getTopRatedListings(limit);
      }

      // Lấy danh sách room_id theo thứ tự wishlist count
      const roomIds = wishlistCounts.map((item) => item._id);

      // Lấy thông tin listings
      const listings = await this.listingRepo.findAll(
        {
          _id: { $in: roomIds },
          isDeleted: false,
          status: ListingStatus.ACTIVE, // Chỉ trả về listing active
        },
        {
          populate: { path: 'propertyId', select: 'name type location' },
        },
      );

      // Sắp xếp lại theo thứ tự wishlist count và thêm wishlistCount vào mỗi listing
      const sortedListings = roomIds
        .map((roomId) => {
          const listing = listings.data.find(
            (l) =>
              (l._id as Types.ObjectId).toString() ===
              (roomId as Types.ObjectId).toString(),
          );
          const wishlistData = wishlistCounts.find(
            (w) =>
              (w._id as Types.ObjectId).toString() ===
              (roomId as Types.ObjectId).toString(),
          );
          return listing
            ? {
                ...listing.toObject(),
                wishlistCount: wishlistData?.wishlistCount || 0,
              }
            : null;
        })
        .filter(Boolean);

      return sortedListings;
    } catch (error) {
      this.logger.error('Error getting top wishlist listings:', error);
      // Fallback to top rated listings if there's an error
      return this.getTopRatedListings(limit);
    }
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
   * Lấy thống kê chi tiết cho một listing với date range filter
   *
   * @param listingId - ID của listing
   * @param queryDto - Query parameters cho date range filter
   * @param user - User thực hiện request (để check permission)
   * @param request - Request object (để check staff filter)
   * @returns Listing statistics object with schema:
   */
  async getListingStatistics(
    listingId: string,
    queryDto: ListingStatisticsDto,
    user?: JwtPayload,
    request?: { staffPropertyIds?: string[] },
  ): Promise<ListingStatisticsResponseDto> {
    // Validate listing exists
    const listing = await this.findOne(listingId);
    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found.`);
    }

    // Check staff access to this listing's property
    if (user && user.role === 'staff') {
      const assignments =
        await this.propertyStaffAssignmentService.getPropertiesByStaff(
          new Types.ObjectId(user._id),
        );

      const staffPropertyIds = assignments.map((assignment: any) => {
        // Handle both populated and unpopulated propertyId
        if (
          typeof assignment.propertyId === 'object' &&
          assignment.propertyId?._id
        ) {
          return assignment.propertyId._id.toString();
        }

        // Handle case where propertyId is a string containing object representation
        if (
          typeof assignment.propertyId === 'string' &&
          assignment.propertyId.includes('ObjectId(')
        ) {
          const match = assignment.propertyId.match(/ObjectId\('([^']+)'\)/);
          if (match) {
            return match[1];
          }
        }

        // If propertyId is already a string or ObjectId
        return assignment.propertyId.toString();
      });

      // Handle case where listing.propertyId is also populated
      let listingPropertyId: string;
      if (typeof listing.propertyId === 'object' && listing.propertyId?._id) {
        listingPropertyId = listing.propertyId._id.toString();
      } else {
        listingPropertyId = listing.propertyId.toString();
      }

      const hasAccess = staffPropertyIds.includes(listingPropertyId);

      if (!hasAccess) {
        throw new ForbiddenException(
          'Staff không có quyền xem thống kê của listing này',
        );
      }
    }

    // Get date range from query
    const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);
    const listingIdObj = new Types.ObjectId(listingId);

    // Base match condition
    const baseMatch = {
      listingId: listingIdObj,
      isDeleted: false,
      created_at: { $gte: startDate, $lte: endDate },
    };

    // 1. Total bookings and revenue (consistent with dashboard logic - no status filter)
    const bookingStats = await this.bookingModel.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$final_amount' },
          totalNights: { $sum: '$nights' },
        },
      },
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      totalNights: 0,
    };

    // 2. Calculate occupancy rate (corrected logic similar to dashboard)
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // For a single listing, totalPossibleNights = totalDays * 1 (only 1 room)
    const totalPossibleNights = totalDays * 1;
    const occupancyRate =
      totalPossibleNights > 0
        ? (stats.totalNights / totalPossibleNights) * 100
        : 0;

    // 3. Review statistics
    const reviewStats = await this.reviewModel.aggregate([
      { $match: { room_id: listingIdObj } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    const reviews = reviewStats[0] || {
      totalReviews: 0,
      averageRating: 0,
    };

    // 4. Wishlist count
    const wishlistCount = await this.wishlistModel.countDocuments({
      listingId: listingIdObj,
    });

    // 5. Detailed voucher statistics
    const voucherDetailsResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          voucher_id: { $exists: true, $ne: null },
          voucher_discount_amount: { $exists: true, $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$voucher_id',
          voucherCode: { $first: '$voucher_code' },
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: '$voucher_discount_amount' },
        },
      },
      {
        $sort: { usageCount: -1 },
      },
    ]);

    const voucherDetails: ListingVoucherDetail[] = voucherDetailsResult.map(
      (item: any) => ({
        voucherId: String(item._id),
        voucherCode: item.voucherCode || 'N/A',
        usageCount: item.usageCount,
        totalDiscount: Math.round(item.totalDiscount),
        averageDiscount: Math.round(item.totalDiscount / item.usageCount),
      }),
    );

    const totalVoucherDiscount = voucherDetailsResult.reduce(
      (sum: number, item: any) => sum + (item.totalDiscount || 0),
      0,
    );
    const totalVouchersUsed = voucherDetailsResult.reduce(
      (sum: number, item: any) => sum + (item.usageCount || 0),
      0,
    );

    // 6. Detailed service statistics
    const serviceDetailsResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          selected_services: { $exists: true, $ne: [] },
        },
      },
      {
        $unwind: '$selected_services',
      },
      {
        $group: {
          _id: '$selected_services.service_id',
          serviceName: { $first: '$selected_services.service_name' },
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: '$selected_services.total_price' },
        },
      },
      {
        $sort: { usageCount: -1 },
      },
    ]);

    const serviceDetails: ListingServiceDetail[] = serviceDetailsResult.map(
      (item: any) => ({
        serviceId: String(item._id),
        serviceName: item.serviceName || 'N/A',
        usageCount: item.usageCount,
        totalRevenue: Math.round(item.totalRevenue),
        averagePrice: Math.round(item.totalRevenue / item.usageCount),
      }),
    );

    const totalServiceRevenue = serviceDetailsResult.reduce(
      (sum: number, item: any) => sum + (item.totalRevenue || 0),
      0,
    );
    const totalServicesUsed = serviceDetailsResult.reduce(
      (sum: number, item: any) => sum + (item.usageCount || 0),
      0,
    );

    // 7. Chart data
    const chartData = await this.getChartData(baseMatch, startDate, endDate);

    return {
      listingId,
      listingTitle: listing.title,
      totalBookings: stats.totalBookings,
      totalRevenue: Math.round(stats.totalRevenue),
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      totalViews: listing.viewCount || 0,
      totalReviews: reviews.totalReviews,
      averageRating: Math.round(reviews.averageRating * 100) / 100,
      wishlistCount,
      totalVoucherDiscount: Math.round(totalVoucherDiscount),
      totalVouchersUsed,
      voucherDetails,
      totalServiceRevenue: Math.round(totalServiceRevenue),
      totalServicesUsed,
      serviceDetails,
      chartData,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Lấy thống kê cho tất cả listings của một property
   */
  async getPropertyListingsStatistics(
    propertyId: string,
    queryDto: ListingStatisticsDto,
  ): Promise<ListingStatisticsResponseDto[]> {
    const propertyIdObj = new Types.ObjectId(propertyId);

    // Lấy tất cả listings của property
    const listings = await this.listingRepo.findAll(
      { propertyId: propertyIdObj, isDeleted: false },
      { limit: 0 },
    );

    const statistics: ListingStatisticsResponseDto[] = [];

    for (const listing of listings.data) {
      try {
        const listingStats = await this.getListingStatistics(
          String(listing._id),
          queryDto,
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

  /**
   * Lấy danh sách listing IDs có sẵn trong khoảng thời gian cụ thể
   */
  private async getAvailableListingIds(
    checkInDate?: string,
    checkOutDate?: string,
    guests?: number,
    minNights?: number,
    maxNights?: number,
  ): Promise<Types.ObjectId[]> {
    try {
      // Nếu không có ngày, trả về tất cả listing IDs
      if (!checkInDate && !checkOutDate) {
        const allListings = await this.listingRepo.findAll(
          { isDeleted: false, status: ListingStatus.ACTIVE },
          { limit: 0 }, // Không giới hạn
        );
        return allListings.data.map((listing) => listing._id as Types.ObjectId);
      }

      // Parse dates
      const checkIn = checkInDate ? new Date(checkInDate) : new Date();
      const checkOut = checkOutDate
        ? new Date(checkOutDate)
        : new Date(checkIn.getTime() + 24 * 60 * 60 * 1000); // +1 day

      // Validate dates
      if (checkIn >= checkOut) {
        this.logger.warn('Invalid date range: checkIn >= checkOut');
        return [];
      }

      // Calculate nights
      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24),
      );

      // Validate nights constraints
      if (minNights && nights < minNights) {
        this.logger.warn(`Nights (${nights}) less than minimum (${minNights})`);
        return [];
      }

      if (maxNights && nights > maxNights) {
        this.logger.warn(`Nights (${nights}) more than maximum (${maxNights})`);
        return [];
      }

      // Tìm tất cả bookings có xung đột với khoảng thời gian này
      const conflictingBookings = await this.bookingModel.aggregate([
        {
          $match: {
            isDeleted: false,
            status: { $nin: ['cancelled', 'rejected'] }, // Chỉ xem xét bookings đã confirm
            $or: [
              // Booking bắt đầu trong khoảng thời gian
              {
                checkInDate: { $gte: checkIn, $lt: checkOut },
              },
              // Booking kết thúc trong khoảng thời gian
              {
                checkOutDate: { $gt: checkIn, $lte: checkOut },
              },
              // Booking bao trọn khoảng thời gian
              {
                checkInDate: { $lte: checkIn },
                checkOutDate: { $gte: checkOut },
              },
            ],
          },
        },
        {
          $group: {
            _id: '$listingId',
            conflictingBookings: { $push: '$$ROOT' },
          },
        },
      ]);

      // Lấy danh sách listing IDs có xung đột
      const conflictingListingIds = conflictingBookings.map(
        (item) => item._id as Types.ObjectId,
      );

      // Lấy tất cả listings có sẵn (không có xung đột)
      const availableListings = await this.listingRepo.findAll(
        {
          isDeleted: false,
          status: ListingStatus.ACTIVE,
          _id: { $nin: conflictingListingIds },
        },
        { limit: 0 }, // Không giới hạn
      );

      // Filter theo số khách nếu có yêu cầu
      let filteredListings = availableListings.data;
      if (guests) {
        filteredListings = filteredListings.filter(
          (listing) => listing.max_guests >= guests,
        );
      }

      return filteredListings.map((listing) => listing._id as Types.ObjectId);
    } catch (error) {
      this.logger.error('Error getting available listing IDs:', error);
      return [];
    }
  }

  /**
   * Helper method to get date range from query DTO (similar to properties service)
   */
  private getDateRangeFromQuery(queryDto: ListingStatisticsDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    switch (queryDto.dateRange) {
      case DateRangeType.TODAY:
        return {
          startDate: today,
          endDate: todayEnd,
        };

      case DateRangeType.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(
          today.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: sevenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_15_DAYS: {
        const fifteenDaysAgo = new Date(
          today.getTime() - 15 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: fifteenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.CUSTOM: {
        if (queryDto.startDate && queryDto.endDate) {
          return {
            startDate: new Date(queryDto.startDate + 'T00:00:00.000Z'),
            endDate: new Date(queryDto.endDate + 'T23:59:59.999Z'),
          };
        }
        // Fall back to last 30 days if custom dates are not provided
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };
      }

      default: {
        // Default to last 30 days
        const defaultThirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: defaultThirtyDaysAgo,
          endDate: todayEnd,
        };
      }
    }
  }

  /**
   * Get chart data for revenue by date
   */
  private async getChartData(
    baseMatch: any,
    startDate: Date,
    endDate: Date,
  ): Promise<ListingChartDataPoint[]> {
    const chartDataResult = await this.bookingModel.aggregate([
      {
        $match: baseMatch, // Remove payment_status filter to be consistent with main stats
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
          },
          totalRevenue: { $sum: '$final_amount' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1,
        },
      },
    ]);

    // Create a map of existing revenue data
    const revenueMap = new Map<string, number>();
    chartDataResult.forEach((item) => {
      const date = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      revenueMap.set(date, item.totalRevenue);
    });

    // Generate complete date range with zero values for missing dates
    const chartData: ListingChartDataPoint[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        totalRevenue: Math.round(revenueMap.get(dateStr) || 0),
      });
      current.setDate(current.getDate() + 1);
    }

    return chartData;
  }
}
