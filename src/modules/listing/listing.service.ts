import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import {
  removeUndefinedObject,
  parseSortString,
  removeFields,
} from '../../utils/common.util';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ListingRepo } from './listing.repo';
import { GooglePlacesService } from '../location/google-places.service';

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

interface NearbyQueryDto {
  lng: number;
  lat: number;
  radius?: number;
}

interface SearchQueryDto {
  keyword?: string;
  priceFrom?: number;
  priceTo?: number;
  property_type?: string;
  guests?: number;
  amenities?: string[];
  location?: { lng: number; lat: number; radius?: number };
  [key: string]: any;
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

  constructor(
    private readonly listingRepo: ListingRepo,
    private readonly googlePlacesService: GooglePlacesService,
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Tạo một listing mới và trả về dữ liệu định dạng
   */
  async create(createListingDto: CreateListingDto, user: JwtPayload) {
    const listing = await this.createListing(createListingDto, user);
    return { listing };
  }

  /**
   * Tìm một listing theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string) {
    const listing = await this.findListingById(id);
    return { listing };
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
    return { listing };
  }

  /**
   * Xóa mềm listing (soft delete) và trả về dữ liệu định dạng
   */
  async remove(id: string, user: JwtPayload) {
    await this.softDeleteListing(id, user);
    return { success: true };
  }

  /**
   * Xóa cứng listing khỏi database (chỉ admin)
   */
  async forceRemove(id: string, user: JwtPayload) {
    await this.forceDeleteListing(id, user);
    return { success: true };
  }

  /**
   * Khôi phục listing đã xóa và trả về dữ liệu định dạng
   */
  async restore(id: string, user: JwtPayload) {
    const listing = await this.restoreListing(id, user);
    return { listing };
  }

  /**
   * Cập nhật trạng thái verify và trả về dữ liệu định dạng
   */
  async verifyListing(id: string, isVerified: boolean, user: JwtPayload) {
    const listing = await this.updateVerification(id, isVerified, user);
    return { listing };
  }

  /**
   * Cập nhật trạng thái hoạt động và trả về dữ liệu định dạng
   */
  async updateStatus(id: string, status: ListingStatus, user: JwtPayload) {
    const listing = await this.changeStatus(id, status, user);
    return { listing };
  }

  /**
   * Tìm danh sách theo bộ lọc và trả về dữ liệu định dạng
   */
  async findAll(queryDto: QueryListingDto) {
    const result = await this.findAllWithFilters(queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Tìm danh sách của một host và trả về dữ liệu định dạng
   */
  async findByHost(hostId: string, queryDto: QueryListingDto) {
    const result = await this.findListingsByHost(hostId, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Tìm danh sách các listing đang active
   */
  async findActive(queryDto: QueryListingDto) {
    const result = await this.findAllActive(queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Tìm danh sách các listing đã xóa mềm (chỉ admin)
   */
  async findDeleted(queryDto: QueryListingDto, user: JwtPayload) {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Chỉ admin mới có quyền truy cập tính năng này',
      );
    }

    const result = await this.findAllDeleted(queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Tìm listing gần vị trí người dùng
   */
  async findNearby(queryDto: NearbyQueryDto, baseQueryDto: QueryListingDto) {
    const { lng, lat, radius = 5 } = queryDto;

    if (!lng || !lat) {
      throw new BadRequestException(
        'Vui lòng cung cấp tọa độ địa lý (lng, lat)',
      );
    }

    const result = await this.findListingsByLocation(
      lng,
      lat,
      radius,
      baseQueryDto,
    );
    const { page = 1, limit = 10 } = baseQueryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Tìm kiếm nâng cao
   */
  async search(searchParams: SearchQueryDto, baseQueryDto: QueryListingDto) {
    // Loại bỏ các tham số phân trang và sắp xếp từ searchParams
    const searchDto = removeFields(searchParams, [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
    ]);

    const result = await this.advancedSearch(searchDto, baseQueryDto);
    const { page: queryPage = 1, limit: queryLimit = 10 } = baseQueryDto;

    return {
      listings: result.data,
      meta: {
        total: result.total,
        page: queryPage,
        limit: queryLimit,
        totalPages: Math.ceil(result.total / queryLimit) || 1,
      },
    };
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
        place_id,
        includeDeleted = false,
        priceFrom,
        priceTo,
        lat,
        lng,
        distance,
        ...filters
      } = queryDto;

      // Xây dựng query dựa trên các bộ lọc
      const query = this.listingRepo.buildFilterQuery(
        filters as ListingFilters,
        includeDeleted,
      );

      // Thêm điều kiện lọc theo giá nếu có
      if (priceFrom !== undefined || priceTo !== undefined) {
        const priceQuery: { $gte?: number; $lte?: number } = {};
        if (priceFrom !== undefined) {
          priceQuery.$gte = priceFrom;
        }
        if (priceTo !== undefined) {
          priceQuery.$lte = priceTo;
        }
        query.price_per_night = priceQuery;
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

      // Ưu tiên place_id search (chính xác hơn)
      if (place_id) {
        // Lấy tọa độ từ place_id
        const coordinates =
          await this.googlePlacesService.getLocationCoordinates(place_id);
        if (coordinates) {
          return await this.listingRepo.findByGeoLocation(
            coordinates.lng,
            coordinates.lat,
            (distance || 10) * 1000, // Default 10km cho place_id search
            query,
            options,
          );
        }
      }

      // Thực hiện truy vấn
      if (keyword) {
        // Tìm kiếm theo từ khóa (fallback)
        return await this.listingRepo.search(
          keyword,
          this.searchFields,
          query,
          options,
        );
      } else if (lat && lng) {
        // Tìm kiếm theo tọa độ trực tiếp
        return await this.listingRepo.findByGeoLocation(
          lng,
          lat,
          (distance || 5) * 1000, // Chuyển km sang m
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
   * Tìm tất cả listings đang active
   */
  private async findAllActive(queryDto: QueryListingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = queryDto;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn
      const options = {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      };

      // Tìm kiếm listings đang active
      return await this.listingRepo.findActive(options);
    } catch (error) {
      this.handleError(error, 'Tìm kiếm listings active');
    }
  }

  /**
   * Tìm tất cả listings đã xóa mềm
   */
  private async findAllDeleted(queryDto: QueryListingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = queryDto;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn
      const options = {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      };

      // Tìm kiếm listings đã xóa mềm
      return await this.listingRepo.findDeleted(options);
    } catch (error) {
      this.handleError(error, 'Tìm kiếm listings đã xóa');
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
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.listingRepo.checkPermission(id, user._id, user.role);

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
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.listingRepo.checkPermission(id, user._id, user.role);

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
   * Xóa cứng listing khỏi database (chỉ admin)
   */
  private async forceDeleteListing(
    id: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      // Kiểm tra quyền (chỉ admin)
      if (!user._id || user.role !== 'admin') {
        throw new ForbiddenException(
          'Chỉ admin mới có quyền xóa vĩnh viễn listing',
        );
      }

      // Kiểm tra tồn tại
      const listing = await this.listingRepo.findById(id);
      if (!listing) {
        throw new NotFoundException(`Không tìm thấy listing với ID ${id}`);
      }

      // Xóa cứng
      const result = await this.listingRepo.forceDelete(id);
      if (!result) {
        throw new BadRequestException(
          `Không thể xóa vĩnh viễn listing với ID ${id}`,
        );
      }
    } catch (error) {
      this.handleError(error, 'Xóa vĩnh viễn listing');
    }
  }

  /**
   * Khôi phục listing đã xóa
   */
  private async restoreListing(id: string, user: JwtPayload): Promise<Listing> {
    try {
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.listingRepo.checkPermission(id, user._id, user.role);

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
      // Kiểm tra quyền - chỉ admin mới có thể xác minh
      if (!user._id || user.role !== 'admin') {
        throw new ForbiddenException('Chỉ admin mới có quyền xác minh listing');
      }

      // Kiểm tra tồn tại
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
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.listingRepo.checkPermission(id, user._id, user.role);

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
   * Tìm listings gần một vị trí địa lý
   */
  private async findListingsByLocation(
    longitude: number,
    latitude: number,
    radius: number = 5,
    queryDto: QueryListingDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        ...filters
      } = queryDto;

      // Xây dựng filter cơ bản
      const baseFilter = this.listingRepo.buildFilterQuery(
        filters as ListingFilters,
        false,
      );

      // Đảm bảo chỉ tìm listing active và đã xác minh
      baseFilter.status = ListingStatus.ACTIVE;
      baseFilter.is_verified = true;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn
      const options = {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      };

      // Tìm kiếm theo vị trí địa lý
      return await this.listingRepo.findByGeoLocation(
        longitude,
        latitude,
        radius * 1000, // Chuyển km sang m
        baseFilter,
        options,
      );
    } catch (error) {
      this.handleError(error, 'Tìm listings gần vị trí');
    }
  }

  /**
   * Tìm kiếm listings nâng cao
   */
  private async advancedSearch(
    searchParams: SearchQueryDto,
    queryDto: QueryListingDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = queryDto;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn
      const options = {
        sort,
        skip,
        limit,
        populate: { path: 'host_id', select: 'name avatar email phone' },
      };

      // Thực hiện tìm kiếm nâng cao
      return await this.listingRepo.advancedSearch(searchParams, options);
    } catch (error) {
      this.handleError(error, 'Tìm kiếm nâng cao listings');
    }
  }

  /**
   * Xử lý lỗi thống nhất
   */
  private handleError(error: any, operation: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
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
