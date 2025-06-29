import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { Review } from './schemas/review.schema';
import { ReviewsRepo } from './reviews.repo';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { parseSortString } from '../../utils/common.util';
import { FilterQuery, Types } from 'mongoose';
import { PropertyService } from '../properties/services/property.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly reviewsRepo: ReviewsRepo,
    private readonly propertyService: PropertyService,
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
  async findAllForAdmin(queryDto: QueryReviewDto) {
    const result = await this.findAllWithFilters(queryDto);
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
    if (!queryDto.keyword) {
      throw new BadRequestException('Từ khóa tìm kiếm không được để trống');
    }

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
   * Tạo review mới (private)
   */
  private async createReview(
    createReviewDto: CreateReviewDto,
    user: JwtPayload,
  ): Promise<Review> {
    try {
      const review = await this.reviewsRepo.create(createReviewDto, user._id);

      // Populate thông tin sau khi tạo
      const populatedReview = await this.reviewsRepo.findById(
        (review as { _id: { toString: () => string } })._id.toString(),
        [
          { path: 'user_id', select: 'name avatar email' },
          { path: 'room_id', select: 'title images address' },
        ],
      );

      if (!populatedReview) {
        throw new Error('Không thể tải thông tin review sau khi tạo');
      }

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
      { path: 'user_id', select: 'name avatar email' },
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
        { path: 'user_id', select: 'name avatar email' },
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
        { path: 'user_id', select: 'name avatar email' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.findByRoomId(roomId, options);
  }

  /**
   * Tìm tất cả reviews với filters (private)
   */
  private async findAllWithFilters(queryDto: QueryReviewDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      user_id,
      room_id,
      rating,
    } = queryDto;

    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    // Build filter
    const filter: FilterQuery<Review> = {};
    if (user_id) filter.user_id = user_id as unknown as Types.ObjectId;
    if (room_id) filter.room_id = room_id as unknown as Types.ObjectId;
    if (rating) filter.rating = rating;

    const options = {
      sort,
      limit,
      skip,
      populate: [
        { path: 'user_id', select: 'name avatar email' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.findAll(filter, options);
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
        { path: 'user_id', select: 'name avatar email' },
        { path: 'room_id', select: 'title images address' },
      ],
    };

    return await this.reviewsRepo.search(keyword, options);
  }

  /**
   * Xóa review (private)
   */
  private async deleteReview(id: string): Promise<void> {
    await this.findReviewById(id); // Kiểm tra tồn tại

    const success = await this.reviewsRepo.deleteById(id);
    if (!success) {
      throw new BadRequestException('Không thể xóa review. Vui lòng thử lại.');
    }

    this.logger.log(`Review ${id} deleted successfully`);
  }
}
