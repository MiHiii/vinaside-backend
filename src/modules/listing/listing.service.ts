import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import {
  removeUndefinedObject,
  parseSortString,
} from '../../utils/common.util';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ListingRepo } from './listing.repo';

// Define types for filter parameters
interface ListingFilters extends Record<string, unknown> {
  host_id?: string;
  property_type?: string;
  status?: string;
  cancel_policy?: string;
  min_guests?: number;
  min_beds?: number;
  min_bathrooms?: number;
  allow_pets?: boolean;
  allow_infants?: boolean;
  is_verified?: boolean;
  amenities?: string[];
  safety_features?: string[];
}

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);
  private readonly searchFields = [
    'title',
    'description',
    'address',
    'building_name',
  ];

  constructor(private readonly listingRepo: ListingRepo) {}

  /**
   * Tạo một listing mới và trả về dữ liệu định dạng
   */
  async create(createListingDto: CreateListingDto, user: JwtPayload) {
    const listing = await this.createListing(createListingDto, user);
    return { data: listing };
  }

  /**
   * Tìm một listing theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string) {
    const listing = await this.findListingById(id);
    return { data: listing };
  }

  /**
   * Cập nhật thông tin listing và trả về dữ liệu định dạng
   */
  async update(
    id: string,
    updateListingDto: UpdateListingDto,
    user: JwtPayload,
  ) {
    const listing = await this.updateListing(id, updateListingDto, user);
    return { data: listing };
  }

  /**
   * Xóa mềm listing (soft delete) và trả về dữ liệu định dạng
   */
  async remove(id: string, user: JwtPayload) {
    await this.softDeleteListing(id, user);
    return { success: true };
  }

  /**
   * Khôi phục listing đã xóa và trả về dữ liệu định dạng
   */
  async restore(id: string) {
    const listing = await this.restoreListing(id);
    return { data: listing };
  }

  /**
   * Cập nhật trạng thái verify và trả về dữ liệu định dạng
   */
  async verifyListing(id: string, isVerified: boolean, user: JwtPayload) {
    const listing = await this.updateVerification(id, isVerified, user);
    return { data: listing };
  }

  /**
   * Cập nhật trạng thái hoạt động và trả về dữ liệu định dạng
   */
  async updateStatus(id: string, status: ListingStatus, user: JwtPayload) {
    const listing = await this.changeStatus(id, status, user);
    return { data: listing };
  }

  /**
   * Tìm danh sách theo bộ lọc và trả về dữ liệu định dạng
   */
  async findAll(queryDto: QueryListingDto) {
    const result = await this.findAllWithFilters(queryDto);
    return result;
  }

  /**
   * Tìm danh sách của một host và trả về dữ liệu định dạng
   */
  async findByHost(hostId: string, queryDto: QueryListingDto) {
    const result = await this.findListingsByHost(hostId, queryDto);
    return result;
  }

  // ====================== INTERNAL METHODS ======================

  /**
   * Tạo một listing mới
   */
  private async createListing(
    createListingDto: CreateListingDto,
    user: JwtPayload,
  ): Promise<Listing> {
    try {
      return await this.listingRepo.create(createListingDto, user._id);
    } catch (error) {
      this.handleError(error, 'Tạo listing');
    }
  }

  /**
   * Tìm tất cả listings theo điều kiện query
   */
  private async findAllWithFilters(queryDto: QueryListingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        keyword,
        includeDeleted = false,
        geo,
        price,
        ...filters
      } = queryDto;

      // Xây dựng query dựa trên các bộ lọc
      const query = this.listingRepo.buildFilterQuery(
        filters as ListingFilters,
        includeDeleted,
      );

      // Thêm điều kiện lọc theo giá nếu có
      if (price) {
        query.price_per_night = {
          $gte: price.min,
          $lte: price.max,
        };
      }

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn cơ bản
      const options = {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      };

      // Thực hiện truy vấn
      if (keyword) {
        // Tìm kiếm theo từ khóa
        return await this.listingRepo.search(
          keyword,
          this.searchFields,
          query,
          options,
        );
      } else if (geo) {
        // Tìm kiếm theo vị trí địa lý
        return await this.listingRepo.findByGeoLocation(
          geo.lng,
          geo.lat,
          geo.distance * 1000, // Chuyển km sang m
          query,
          options,
        );
      } else {
        // Tìm kiếm thông thường
        return await this.listingRepo.findAll(query, options);
      }
    } catch (error) {
      this.handleError(error, 'Tìm kiếm listings');
    }
  }

  /**
   * Tìm một listing theo ID
   */
  private async findListingById(id: string): Promise<Listing> {
    try {
      const listing = await this.listingRepo.findById(id, {
        path: 'host_id',
        select: 'name avatar email phone',
      });

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      return listing;
    } catch (error) {
      this.handleError(error, 'Tìm listing');
    }
  }

  /**
   * Cập nhật thông tin listing
   */
  private async updateListing(
    id: string,
    updateListingDto: UpdateListingDto,
    user: JwtPayload,
  ): Promise<Listing> {
    try {
      const listing = await this.listingRepo.findById(id);

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Loại bỏ các trường undefined
      const cleanUpdateData = removeUndefinedObject(updateListingDto);

      // Cập nhật listing
      const updatedListing = await this.listingRepo.updateById(
        id,
        cleanUpdateData,
        user._id,
      );

      if (!updatedListing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      return updatedListing;
    } catch (error) {
      this.handleError(error, 'Cập nhật listing');
    }
  }

  /**
   * Xóa mềm listing (soft delete)
   */
  private async softDeleteListing(id: string, user: JwtPayload): Promise<void> {
    try {
      const listing = await this.listingRepo.findById(id);

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Soft delete
      const deletedListing = await this.listingRepo.softDelete(id, user._id);

      if (!deletedListing) {
        throw new NotFoundException(`Không thể xóa listing với ID ${id}`);
      }
    } catch (error) {
      this.handleError(error, 'Xóa listing');
    }
  }

  /**
   * Khôi phục listing đã xóa
   */
  private async restoreListing(id: string): Promise<Listing> {
    try {
      const listing = await this.listingRepo.findById(id);

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Khôi phục
      const restoredListing = await this.listingRepo.restore(id);

      if (!restoredListing) {
        throw new NotFoundException(`Không thể khôi phục listing với ID ${id}`);
      }

      return restoredListing;
    } catch (error) {
      this.handleError(error, 'Khôi phục listing');
    }
  }

  /**
   * Cập nhật trạng thái verify
   */
  private async updateVerification(
    id: string,
    isVerified: boolean,
    user: JwtPayload,
  ): Promise<Listing> {
    try {
      const listing = await this.listingRepo.findById(id);

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Cập nhật trạng thái xác minh
      const updatedListing = await this.listingRepo.updateVerificationStatus(
        id,
        isVerified,
        user._id,
      );

      if (!updatedListing) {
        throw new NotFoundException(
          `Không thể cập nhật trạng thái xác minh cho listing với ID ${id}`,
        );
      }

      return updatedListing;
    } catch (error) {
      this.handleError(error, 'Xác minh listing');
    }
  }

  /**
   * Cập nhật trạng thái hoạt động
   */
  private async changeStatus(
    id: string,
    status: ListingStatus,
    user: JwtPayload,
  ): Promise<Listing> {
    try {
      const listing = await this.listingRepo.findById(id);

      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Cập nhật trạng thái hoạt động
      const updatedListing = await this.listingRepo.updateStatus(
        id,
        status,
        user._id,
      );

      if (!updatedListing) {
        throw new NotFoundException(
          `Không thể cập nhật trạng thái cho listing với ID ${id}`,
        );
      }

      return updatedListing;
    } catch (error) {
      this.handleError(error, 'Cập nhật trạng thái listing');
    }
  }

  /**
   * Tìm các phòng của một host
   */
  private async findListingsByHost(hostId: string, queryDto: QueryListingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query với host_id
      const hostObjectId = new Types.ObjectId(hostId);
      const query: FilterQuery<Listing> = { host_id: hostObjectId };

      // Thêm các bộ lọc khác
      const fullQuery = {
        ...this.listingRepo.buildFilterQuery(
          filters as ListingFilters,
          includeDeleted,
        ),
        ...query,
      };

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.listingRepo.findAll(fullQuery, {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      });
    } catch (error) {
      this.handleError(error, 'Tìm listings theo host');
    }
  }

  /**
   * Xử lý lỗi thống nhất
   */
  private handleError(error: any, operation: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }

    this.logger.error(
      `Lỗi khi ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  }
}
