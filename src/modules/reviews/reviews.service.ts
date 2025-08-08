import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { Review } from './schemas/review.schema';
import { ReviewsRepo } from './reviews.repo';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { parseSortString } from '../../utils/common.util';
import { FilterQuery, Types } from 'mongoose';
import { PropertyService } from '../properties/services/property.service';
import { ListingService } from '../listing/listing.service';
import { Listing } from '../listing/schemas/listing.schema';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/schemas/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  RecipientType,
  NotificationStatus,
  SentMethod,
} from '../notifications/schemas/notification.schema';
import { forwardRef, Inject } from '@nestjs/common';
import {
  applyStaffFilter,
  RequestWithStaffFilter,
} from '../../utils/staff-filter.util';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly reviewsRepo: ReviewsRepo,
    private readonly propertyService: PropertyService,
    private readonly listingService: ListingService,
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
    @Inject(forwardRef(() => BookingService))
    private readonly bookingService: BookingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Tạo một review mới
   */
  async create(createReviewDto: CreateReviewDto, user: JwtPayload) {
    // Kiểm tra xem user đã review room này chưa
    const existingReview = await this.reviewsRepo.checkExistingReview(
      user._id,
      createReviewDto.room_id,
    );

    if (existingReview) {
      throw new BadRequestException(
        'Bạn đã đánh giá phòng này rồi. Mỗi user chỉ được đánh giá một lần cho mỗi phòng.',
      );
    }

    // Kiểm tra xem user đã đặt phòng và checkout chưa
    await this.validateBookingForReview(user._id, createReviewDto.room_id);

    const review = await this.createReview(createReviewDto, user);
    return { review };
  }

  /**
   * Lấy danh sách reviews của user hiện tại
   */
  async findMyReviews(queryDto: QueryReviewDto, user: JwtPayload) {
    const result = await this.findReviewsByUser(user._id, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      reviews: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Lấy tất cả reviews của một phòng (public)
   */
  async findRoomReviews(roomId: string, queryDto: QueryReviewDto) {
    const result = await this.findReviewsByRoom(roomId, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      reviews: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Lấy chi tiết một review
   */
  async findOne(id: string) {
    const review = await this.findReviewById(id);
    return { review };
  }

  /**
   * Admin/Staff: Lấy tất cả reviews với filter
   * Note: Permission checking is now handled by @RequirePropertyStaff decorator
   */
  async findAllForAdmin(
    queryDto: QueryReviewDto,
    user?: JwtPayload,
    request?: RequestWithStaffFilter,
  ) {
    const result = await this.findAllWithFilters(queryDto, user, request);
    const { page = 1, limit = 10 } = queryDto;

    return {
      reviews: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Admin/Staff: Tìm kiếm reviews
   * Note: Permission checking is now handled by @RequirePropertyStaff decorator
   */
  async searchForAdmin(queryDto: QueryReviewDto) {
    // Nếu có keyword thì search, nếu không thì chỉ filter
    if (queryDto.keyword) {
      const result = await this.searchReviews(queryDto.keyword, queryDto);
      const { page = 1, limit = 10 } = queryDto;

      return {
        reviews: result.data,
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit) || 1,
        },
      };
    } else {
      // Nếu không có keyword, dùng filter như findAllForAdmin
      return this.findAllForAdmin(queryDto);
    }
  }

  /**
   * Admin/Staff: Lấy thống kê reviews
   * Note: Permission checking is now handled by @RequirePropertyStaff decorator
   */
  async getStatistics() {
    const statistics = await this.reviewsRepo.getStatistics();
    return { statistics };
  }

  /**
   * Admin/Staff: Xóa review
   * Note: Permission checking is now handled by @RequirePropertyStaff decorator
   */
  async remove(id: string) {
    await this.deleteReview(id);
    return { success: true };
  }

  // =========================== PRIVATE HELPER METHODS ===========================

  /**
   * Kiểm tra xem user có thể đánh giá phòng này không
   */
  private async validateBookingForReview(
    userId: string,
    roomId: string,
  ): Promise<void> {
    try {
      // Tìm booking của user cho phòng này với status CONFIRMED hoặc COMPLETED
      const bookings = await this.bookingService.findAll({
        guestId: userId,
        listingId: roomId,
        status: BookingStatus.CONFIRMED, // Cho phép đánh giá khi status CONFIRMED
        page: 1,
        limit: 1,
      });

      if (bookings.data.length === 0) {
        // Thử tìm với status COMPLETED nếu không tìm thấy CONFIRMED
        const completedBookings = await this.bookingService.findAll({
          guestId: userId,
          listingId: roomId,
          status: BookingStatus.COMPLETED,
          page: 1,
          limit: 1,
        });

        if (completedBookings.data.length === 0) {
          throw new BadRequestException(
            'Bạn chỉ có thể đánh giá phòng sau khi đã đặt phòng và được xác nhận. Vui lòng đợi đến khi booking được xác nhận.',
          );
        }
      }

      // Lấy booking (CONFIRMED hoặc COMPLETED)
      const booking =
        bookings.data[0] ||
        (
          await this.bookingService.findAll({
            guestId: userId,
            listingId: roomId,
            status: BookingStatus.COMPLETED,
            page: 1,
            limit: 1,
          })
        ).data[0];

      // Kiểm tra xem booking đã checkout chưa (checkout date đã qua)
      const checkoutDate = new Date(booking.check_out_date);
      const currentDate = new Date();

      // Reset time để chỉ so sánh ngày
      checkoutDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);

      if (checkoutDate > currentDate) {
        throw new BadRequestException(
          'Bạn chỉ có thể đánh giá phòng sau khi đã checkout. Vui lòng đợi đến khi chuyến đi kết thúc.',
        );
      }

      this.logger.log(
        `Booking validation passed for user ${userId} and room ${roomId}`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error validating booking for review: ${error}`);
      throw new BadRequestException(
        'Không thể kiểm tra thông tin đặt phòng. Vui lòng thử lại.',
      );
    }
  }

  /**
   * Tạo review mới (private)
   */
  private async createReview(
    createReviewDto: CreateReviewDto,
    user: JwtPayload,
  ): Promise<Review> {
    try {
      // Lấy property_id từ room_id
      const listing = await this.listingModel
        .findById(createReviewDto.room_id)
        .select('propertyId');
      if (!listing) {
        throw new BadRequestException('Phòng không tồn tại');
      }

      const reviewData = {
        ...createReviewDto,
        property_id: listing.propertyId.toString(),
      };

      const review = await this.reviewsRepo.create(reviewData, user._id);

      // Populate thông tin sau khi tạo
      const populatedReview = await this.reviewsRepo.findById(
        (review as { _id: { toString: () => string } })._id.toString(),
        [
          {
            path: 'user_id',
            select:
              'name avatar_url email phone role is_verified language customRoles',
          },
          { path: 'property_id', select: 'name address' },
          { path: 'room_id', select: 'title images address' },
        ],
      );

      if (!populatedReview) {
        throw new Error('Không thể tải thông tin review sau khi tạo');
      }

      // Cập nhật rating của listing sau khi tạo review
      await this.updateListingRating(createReviewDto.room_id);

      this.logger.log(`Review created successfully by user ${user._id}`);
      return populatedReview;
    } catch (error) {
      this.logger.error(`Error creating review: ${(error as Error).message}`);
      throw new BadRequestException('Không thể tạo review. Vui lòng thử lại.');
    }
  }

  /**
   * Tìm review theo ID (private)
   */
  private async findReviewById(id: string): Promise<Review> {
    const review = await this.reviewsRepo.findById(id, [
      {
        path: 'user_id',
        select:
          'name avatar_url email phone role is_verified language customRoles',
      },
      { path: 'property_id', select: 'name address' },
      { path: 'room_id', select: 'title images address' },
    ]);

    if (!review) {
      throw new NotFoundException(`Review với ID ${id} không tồn tại`);
    }

    return review;
  }

  /**
   * Tìm reviews theo user (private)
   */
  private async findReviewsByUser(userId: string, queryDto: QueryReviewDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    const options = {
      sort,
      limit,
      skip,
      populate: [
        {
          path: 'user_id',
          select:
            'name avatar_url email phone role is_verified language customRoles',
        },
        { path: 'property_id', select: 'name address' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.findByUserId(userId, options);
  }

  /**
   * Tìm reviews theo room (private)
   */
  private async findReviewsByRoom(roomId: string, queryDto: QueryReviewDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    const options = {
      sort,
      limit,
      skip,
      populate: [
        {
          path: 'user_id',
          select:
            'name avatar_url email phone role is_verified language customRoles',
        },
        { path: 'property_id', select: 'name address' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.findByRoomId(roomId, options);
  }

  /**
   * Tìm tất cả reviews với filters (private)
   */
  private async findAllWithFilters(
    queryDto: QueryReviewDto,
    user?: JwtPayload,
    request?: RequestWithStaffFilter,
  ) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      user_id,
      property_id,
      room_id,
      rating,
    } = queryDto;

    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    // Build filter
    const filter: FilterQuery<Review> = {};
    if (user_id) filter.user_id = user_id as unknown as Types.ObjectId;
    if (property_id)
      filter.property_id = property_id as unknown as Types.ObjectId;
    if (room_id) filter.room_id = room_id as unknown as Types.ObjectId;
    if (rating) filter.rating = rating;

    // Apply staff filtering using utility function
    const filteredFilter = applyStaffFilter(
      filter,
      request || undefined,
      'room_id',
    );

    const options = {
      sort,
      limit,
      skip,
      populate: [
        {
          path: 'user_id',
          select:
            'name avatar_url email phone role is_verified language customRoles',
        },
        { path: 'property_id', select: 'name address' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.findAll(filteredFilter, options);
  }

  /**
   * Tìm kiếm reviews (private)
   */
  private async searchReviews(keyword: string, queryDto: QueryReviewDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    const options = {
      sort,
      limit,
      skip,
      populate: [
        {
          path: 'user_id',
          select:
            'name avatar_url email phone role is_verified language customRoles',
        },
        { path: 'property_id', select: 'name address' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.search(keyword, options);
  }

  /**
   * Xóa review (private)
   */
  private async deleteReview(id: string): Promise<void> {
    const review = await this.findReviewById(id); // Kiểm tra tồn tại và lấy room_id
    const roomId = review.room_id.toString();

    const success = await this.reviewsRepo.deleteById(id);
    if (!success) {
      throw new BadRequestException('Không thể xóa review. Vui lòng thử lại.');
    }

    // Cập nhật rating của listing sau khi xóa review
    await this.updateListingRating(roomId);

    this.logger.log(`Review ${id} deleted successfully`);
  }

  /**
   * Cập nhật average_rating và reviews_count của listing
   */
  private async updateListingRating(roomId: string): Promise<void> {
    try {
      // Tính toán rating trung bình và số lượng reviews
      const stats = await this.reviewsRepo.getRoomRatingStats(roomId);

      // Cập nhật listing sử dụng model trực tiếp
      await this.listingModel.findByIdAndUpdate(roomId, {
        average_rating: Math.round(stats.averageRating * 10) / 10,
        reviews_count: stats.totalReviews,
      });

      this.logger.log(
        `Updated listing ${roomId} - rating: ${stats.averageRating}, count: ${stats.totalReviews}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating listing rating for room ${roomId}:`,
        error,
      );
      // Không throw error để không ảnh hưởng đến flow chính
    }
  }

  /**
   * Tạo thông báo đánh giá phòng khi booking status = COMPLETED
   */
  async createReviewNotification(bookingId: string): Promise<void> {
    try {
      // Lấy thông tin booking
      const booking = await this.bookingService.findOne(bookingId);
      if (!booking) {
        this.logger.warn(
          `Booking ${bookingId} not found for review notification`,
        );
        return;
      }

      // Kiểm tra xem user đã đánh giá phòng này chưa
      const existingReview = await this.reviewsRepo.checkExistingReview(
        booking.guestId,
        booking.listingId,
      );

      if (existingReview) {
        this.logger.log(
          `User ${booking.guestId} already reviewed room ${booking.listingId}`,
        );
        return;
      }

      // Tạo thông báo đánh giá phòng
      await this.notificationsService.create({
        user_id: booking.guestId,
        recipient_type: RecipientType.GUEST,
        title: 'Đánh giá chuyến đi của bạn',
        message: `Chuyến đi của bạn đã kết thúc. Hãy chia sẻ trải nghiệm của bạn về ${booking.listingId} để giúp chúng tôi cải thiện dịch vụ!`,
        type: NotificationType.REMINDER,
        status: NotificationStatus.SENT,
        sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
      });

      this.logger.log(`Created review notification for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(
        `Error creating review notification for booking ${bookingId}:`,
        error,
      );
    }
  }
}
