import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types, SortOrder } from 'mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { ListingRepo } from './listing.repo';
import { PropertyService } from '../properties/services/property.service';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';

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
          ratings: { $push: '$rating' },
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

    const { total, averageRating, ratings } = stats[0] as {
      total: number;
      averageRating: number;
      ratings: number[];
    };

    // Tính phân bố rating
    const ratingDistribution: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    ratings.forEach((rating: number) => {
      ratingDistribution[rating]++;
    });

    return {
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
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
        await mongoose
          .model('Listing')
          .findByIdAndUpdate((listing as Listing)._id, {
            average_rating: Math.round(averageRating * 10) / 10,
            reviews_count: reviewsCount,
          });

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
}
