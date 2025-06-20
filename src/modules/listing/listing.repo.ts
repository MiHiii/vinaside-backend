import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  SortOrder,
  Types,
} from 'mongoose';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

interface UpdateFields {
  updatedBy?: Types.ObjectId;
  [key: string]: any;
}

interface DeleteFields {
  isDeleted: boolean;
  deletedAt: Date | undefined;
  deletedBy: Types.ObjectId | undefined;
}

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
export class ListingRepo {
  constructor(
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
  ) {}

  /**
   * Tạo listing mới
   */
  async create(
    createListingDto: CreateListingDto,
    userId?: string,
  ): Promise<Listing> {
    const createdBy = userId ? new Types.ObjectId(userId) : undefined;

    // Đảm bảo host_id được gán bằng userId (người đăng nhập)
    const data = {
      ...createListingDto,
      host_id: new Types.ObjectId(userId),
      createdBy,
    };

    const listing = new this.listingModel(data);
    return await listing.save();
  }

  /**
   * Tìm listing theo ID
   */
  async findById(
    id: string,
    populate?: PopulateOptions | Array<PopulateOptions>,
  ): Promise<Listing | null> {
    const query = this.listingModel.findById(id);

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
   * Tìm tất cả listings theo điều kiện
   */
  async findAll(
    filter: FilterQuery<Listing> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    const { sort, limit, skip, populate } = options;

    // Tạo query
    const query = this.listingModel.find(filter);

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
      this.listingModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Tìm tất cả listings có status active
   */
  async findActive(
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    const filter: FilterQuery<Listing> = {
      status: ListingStatus.ACTIVE,
      isDeleted: false,
      is_verified: true,
    };

    return await this.findAll(filter, options);
  }

  /**
   * Tìm tất cả listings đã xóa mềm (chỉ admin)
   */
  async findDeleted(
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    const filter: FilterQuery<Listing> = { isDeleted: true };

    return await this.findAll(filter, options);
  }

  /**
   * Cập nhật listing
   */
  async updateById(
    id: string,
    updateData: Partial<UpdateListingDto>,
    userId?: string,
  ): Promise<Listing | null> {
    // Thêm thông tin người cập nhật nếu có
    const dataToUpdate: UpdateFields = { ...updateData };
    if (userId) {
      dataToUpdate.updatedBy = new Types.ObjectId(userId);
    }

    return await this.listingModel
      .findByIdAndUpdate(id, dataToUpdate, { new: true })
      .populate({ path: 'host_id', select: 'name avatar email phone' })
      .exec();
  }

  /**
   * Xóa mềm listing
   */
  async softDelete(id: string, userId?: string): Promise<Listing | null> {
    const updateData: DeleteFields = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    return await this.listingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Xóa cứng listing khỏi database (chỉ admin)
   */
  async forceDelete(id: string): Promise<boolean> {
    const result = await this.listingModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Khôi phục listing đã xóa mềm
   */
  async restore(id: string): Promise<Listing | null> {
    const updateData: DeleteFields = {
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
    };

    return await this.listingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Tìm kiếm theo tọa độ địa lý
   */
  async findByGeoLocation(
    longitude: number,
    latitude: number,
    maxDistance: number = 5000, // Mặc định 5km
    filter: FilterQuery<Listing> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    const { sort, limit, skip, populate } = options;

    // Tạo aggregation pipeline với $geoNear
    const pipeline: any[] = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distance', // Thêm field distance vào kết quả
          maxDistance: maxDistance, // đơn vị: mét
          spherical: true,
          query: filter, // Thêm filter conditions
        },
      },
    ];

    // Thêm sort nếu có (sau khi đã có distance)
    if (sort) {
      pipeline.push({ $sort: sort });
    } else {
      // Mặc định sort theo distance tăng dần
      pipeline.push({ $sort: { distance: 1 } });
    }

    // Thêm skip nếu có
    if (skip !== undefined) {
      pipeline.push({ $skip: skip });
    }

    // Thêm limit nếu có
    if (limit !== undefined) {
      pipeline.push({ $limit: limit });
    }

    // Thực hiện aggregation
    const [data, totalResult] = await Promise.all([
      this.listingModel.aggregate(pipeline).exec(),
      this.listingModel
        .aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              distanceField: 'distance',
              maxDistance: maxDistance,
              spherical: true,
              query: filter,
            },
          },
          { $count: 'total' },
        ])
        .exec(),
    ]);

    const total =
      totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    // Populate nếu cần
    let populatedData: Listing[] = data as Listing[];
    if (populate) {
      populatedData = (await this.listingModel.populate(
        data,
        populate,
      )) as Listing[];
    }

    return { data: populatedData, total };
  }

  /**
   * Tìm kiếm theo từ khóa
   */
  async search(
    keyword: string,
    searchFields: string[],
    filter: FilterQuery<Listing> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    // Tạo điều kiện tìm kiếm cho từng trường
    const searchConditions = searchFields.map((field) => ({
      [field]: { $regex: keyword, $options: 'i' },
    }));

    // Kết hợp điều kiện tìm kiếm với filter
    const searchFilter: FilterQuery<Listing> = {
      ...filter,
      $or: searchConditions,
    };

    return await this.findAll(searchFilter, options);
  }

  /**
   * Tìm kiếm nâng cao với nhiều tiêu chí
   */
  async advancedSearch(
    searchParams: {
      keyword?: string;
      priceFrom?: number;
      priceTo?: number;
      property_type?: string;
      guests?: number;
      amenities?: string[];
      location?: { lng: number; lat: number; radius?: number };
      [key: string]: unknown;
    },
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Listing[]; total: number }> {
    const { keyword, priceFrom, priceTo, location, ...otherParams } =
      searchParams;

    // Tạo filter cơ bản
    const filter: FilterQuery<Listing> = {
      isDeleted: false,
      status: ListingStatus.ACTIVE,
    };

    // Thêm điều kiện lọc theo giá
    if (priceFrom !== undefined || priceTo !== undefined) {
      const priceFilter: Record<string, number> = {};

      if (priceFrom !== undefined) {
        priceFilter.$gte = priceFrom;
      }

      if (priceTo !== undefined) {
        priceFilter.$lte = priceTo;
      }

      filter.price_per_night = priceFilter;
    }

    // Thêm các tiêu chí khác
    Object.keys(otherParams).forEach((key) => {
      const value = otherParams[key];
      if (value !== undefined) {
        if (key === 'guests') {
          filter.max_guests = { $gte: Number(value) };
        } else if (
          key === 'amenities' &&
          Array.isArray(value) &&
          value.length > 0
        ) {
          filter.amenities = {
            $all: value.map((id) => new Types.ObjectId(String(id))),
          };
        } else if (value !== null && value !== '') {
          // Sử dụng assertion cụ thể để TypeScript hiểu
          (filter as Record<string, unknown>)[key] = value;
        }
      }
    });

    // Xử lý tìm kiếm theo vị trí địa lý nếu có
    if (location && location.lng !== undefined && location.lat !== undefined) {
      return await this.findByGeoLocation(
        location.lng,
        location.lat,
        location.radius ? location.radius * 1000 : 5000, // Mặc định 5km
        filter,
        options,
      );
    }

    // Xử lý tìm kiếm theo từ khóa nếu có
    if (keyword) {
      return await this.search(
        keyword,
        ['title', 'description', 'address', 'building_name'],
        filter,
        options,
      );
    }

    // Tìm kiếm thông thường
    return await this.findAll(filter, options);
  }

  /**
   * Cập nhật trạng thái xác minh
   */
  async updateVerificationStatus(
    id: string,
    isVerified: boolean,
    userId?: string,
  ): Promise<Listing | null> {
    const updateData: UpdateFields = {
      is_verified: isVerified,
    };

    if (userId) {
      updateData.updatedBy = new Types.ObjectId(userId);
    }

    return await this.listingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Cập nhật trạng thái listing
   */
  async updateStatus(
    id: string,
    status: string,
    userId?: string,
  ): Promise<Listing | null> {
    const updateData: UpdateFields = { status };

    if (userId) {
      updateData.updatedBy = new Types.ObjectId(userId);
    }

    return await this.listingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Xây dựng query filter cho listing
   */
  buildFilterQuery(
    filters: ListingFilters,
    includeDeleted: boolean,
  ): FilterQuery<Listing> {
    const query: FilterQuery<Listing> = {};

    // Các trường lọc cơ bản
    if (filters.host_id) {
      query.host_id = new Types.ObjectId(filters.host_id);
    }

    if (filters.property_type) {
      query.property_type = filters.property_type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.cancel_policy) {
      query.cancel_policy = filters.cancel_policy;
    }

    if (filters.min_guests) {
      query.max_guests = { $gte: filters.min_guests };
    }

    if (filters.min_beds) {
      query.beds = { $gte: filters.min_beds };
    }

    if (filters.min_bathrooms) {
      query.bathrooms = { $gte: filters.min_bathrooms };
    }

    if (filters.allow_pets !== undefined) {
      query.allow_pets = filters.allow_pets;
    }

    if (filters.allow_infants !== undefined) {
      query.allow_infants = filters.allow_infants;
    }

    if (filters.is_verified !== undefined) {
      query.is_verified = filters.is_verified;
    }

    // Lọc theo amenities
    if (
      filters.amenities &&
      Array.isArray(filters.amenities) &&
      filters.amenities.length > 0
    ) {
      query.amenities = {
        $all: filters.amenities.map((id) => new Types.ObjectId(id)),
      };
    }

    // Lọc theo tính năng an toàn
    if (
      filters.safety_features &&
      Array.isArray(filters.safety_features) &&
      filters.safety_features.length > 0
    ) {
      query.safety_features = {
        $all: filters.safety_features.map((id) => new Types.ObjectId(id)),
      };
    }

    // Không bao gồm bản ghi đã xóa trừ khi được yêu cầu
    if (!includeDeleted) {
      query.isDeleted = false;
    }

    return query;
  }

  /**
   * Kiểm tra quyền truy cập vào listing
   * @param listingId ID của listing cần kiểm tra
   * @param userId ID của người dùng
   * @param role Vai trò của người dùng
   * @returns Đối tượng listing nếu có quyền, hoặc throw Exception nếu không có quyền
   */
  async checkPermission(
    listingId: string,
    userId: string,
    role: string,
  ): Promise<Listing> {
    const listing = await this.findById(listingId);

    if (!listing) {
      throw new NotFoundException(`Không tìm thấy listing với ID ${listingId}`);
    }

    // Nếu là admin thì luôn có quyền
    if (role === 'admin') {
      return listing;
    }

    // Nếu là host, kiểm tra xem có phải chủ sở hữu không
    if (role === 'host') {
      if (listing.host_id.toString() !== userId) {
        throw new BadRequestException(
          'Bạn không có quyền thao tác với listing này',
        );
      }
      return listing;
    }

    // Nếu không thuộc các role trên
    throw new BadRequestException('Bạn không có quyền thực hiện thao tác này');
  }
}
