import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  UpdateQuery,
  Types,
} from 'mongoose';
import { Amenity, AmenityDocument } from './schemas/amenity.schema';
import { QueryAmenityDto } from './dto/query-amenity.dto';

@Injectable()
export class AmenitiesRepo {
  constructor(
    @InjectModel(Amenity.name) private amenityModel: Model<Amenity>,
  ) {}

  /**
   * Tìm amenity theo ID
   */
  async findById(id: string): Promise<AmenityDocument | null> {
    return this.amenityModel.findById(id).exec();
  }

  /**
   * Tìm amenity active theo ID (không bị xóa)
   */
  async findActiveById(id: string): Promise<AmenityDocument | null> {
    return this.amenityModel
      .findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
      .exec();
  }

  /**
   * Tìm amenity đã bị xóa theo ID
   */
  async findDeletedById(id: string): Promise<AmenityDocument | null> {
    return this.amenityModel
      .findOne({
        _id: id,
        isDeleted: true,
      })
      .exec();
  }

  /**
   * Tạo amenity mới
   */
  async create(data: Partial<Amenity>): Promise<AmenityDocument> {
    const amenity = new this.amenityModel(data);
    return amenity.save();
  }

  /**
   * Cập nhật thông tin amenity theo ID
   */
  async updateById(
    id: string,
    updateData: UpdateQuery<Amenity>,
  ): Promise<AmenityDocument | null> {
    return this.amenityModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Toggle trạng thái active/inactive
   */
  async toggleStatus(
    id: string,
    updatedBy: string | Types.ObjectId,
  ): Promise<AmenityDocument | null> {
    const amenity = await this.findActiveById(id);
    if (!amenity) return null;

    const newStatus = !amenity.is_active;
    return this.updateById(id, {
      is_active: newStatus,
      updatedBy: new Types.ObjectId(updatedBy.toString()),
    });
  }

  /**
   * Toggle trạng thái default_checked
   */
  async toggleDefaultChecked(
    id: string,
    updatedBy: string | Types.ObjectId,
  ): Promise<AmenityDocument | null> {
    const amenity = await this.findActiveById(id);
    if (!amenity) return null;

    const newDefaultStatus = !amenity.default_checked;
    return this.updateById(id, {
      default_checked: newDefaultStatus,
      updatedBy: new Types.ObjectId(updatedBy.toString()),
    });
  }

  /**
   * Đánh dấu xóa amenity (soft delete)
   */
  async softDelete(
    id: string,
    deletedBy: string,
  ): Promise<AmenityDocument | null> {
    return this.amenityModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Khôi phục amenity
   */
  async restore(
    id: string,
    updatedBy: string,
  ): Promise<AmenityDocument | null> {
    return this.amenityModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedBy,
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Tìm tất cả amenities với filters từ DTO
   */
  async findAllWithFilters(queryDto: QueryAmenityDto): Promise<{
    data: AmenityDocument[];
    total: number;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeDeleted = false,
      search,
      is_active,
    } = queryDto;

    // Build query
    const query: FilterQuery<Amenity> = {
      isDeleted: includeDeleted ? { $in: [true, false] } : false,
    };

    // Apply is_active filter if provided
    if (typeof is_active === 'boolean') {
      query.is_active = is_active;
    }

    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const result = await this.findAll(query, {
      sort,
      limit,
      page,
      includeDeleted,
    });

    return {
      ...result,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / (limit || 1)),
        hasNext: page < Math.ceil(result.total / (limit || 1)),
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Tìm tất cả amenities với phân trang và lọc
   */
  async findAll(
    query: FilterQuery<AmenityDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      select?: string;
      populate?: PopulateOptions | (string | PopulateOptions)[];
      includeDeleted?: boolean;
    } = {},
  ): Promise<{
    data: AmenityDocument[];
    total: number;
  }> {
    const {
      page = 1,
      limit = 10,
      sort,
      select,
      populate,
      includeDeleted = false,
    } = options;
    const skip = (page - 1) * limit;

    // Thêm filter loại bỏ các bản ghi bị xóa (trừ khi includeDeleted = true)
    const finalQuery = includeDeleted
      ? query
      : {
          ...query,
          isDeleted: { $ne: true },
        };

    // Đếm tổng số bản ghi
    const total = await this.amenityModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.amenityModel
      .find(finalQuery)
      .limit(limit)
      .skip(skip)
      .sort(sort || { created_at: -1 })
      .select(select || '')
      .populate(populate || [])
      .exec();

    return {
      data,
      total,
    };
  }

  /**
   * Tìm kiếm amenities cho public endpoints
   */
  async searchPublic(query: string): Promise<{
    data: AmenityDocument[];
    total: number;
  }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0 };
    }

    const searchFilters = { isDeleted: false };
    return this.search(query.trim(), ['name', 'description'], searchFilters);
  }

  /**
   * Tìm kiếm amenities theo từ khóa
   */
  async search(
    searchTerm: string,
    searchFields: string[] = ['name', 'description'],
    additionalFilters: FilterQuery<AmenityDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<{
    data: AmenityDocument[];
    total: number;
  }> {
    const { page = 1, limit = 10, sort } = options;
    const skip = (page - 1) * limit;

    // Tạo search query cho các trường
    const searchQuery = {
      $or: searchFields.map((field) => ({
        [field]: { $regex: searchTerm, $options: 'i' },
      })),
    };

    // Kết hợp với các filter bổ sung
    const finalQuery = {
      ...additionalFilters,
      ...searchQuery,
    };

    // Đếm tổng số bản ghi
    const total = await this.amenityModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.amenityModel
      .find(finalQuery)
      .limit(limit)
      .skip(skip)
      .sort(sort || { created_at: -1 })
      .exec();

    return {
      data,
      total,
    };
  }

  /**
   * Tìm amenity theo ID và createdBy
   */
  async findByIdAndCreatedBy(
    id: string,
    createdBy: string,
    includeDeleted = false,
  ): Promise<AmenityDocument | null> {
    const query: FilterQuery<AmenityDocument> = {
      _id: id,
      createdBy,
    };

    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }

    return this.amenityModel.findOne(query).exec();
  }

  /**
   * Đếm số lượng amenities với filter
   */
  async count(filter: FilterQuery<Amenity> = {}): Promise<number> {
    return this.amenityModel.countDocuments(filter).exec();
  }
}
