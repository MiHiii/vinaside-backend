import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions, UpdateQuery } from 'mongoose';
import { Amenity, AmenityDocument } from './schemas/amenity.schema';

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
