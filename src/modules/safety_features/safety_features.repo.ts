import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions, UpdateQuery } from 'mongoose';
import {
  SafetyFeature,
  SafetyFeatureDocument,
} from './schemas/safety_feature.schema';

@Injectable()
export class SafetyFeaturesRepo {
  constructor(
    @InjectModel(SafetyFeature.name)
    private safetyFeatureModel: Model<SafetyFeature>,
  ) {}

  /**
   * Tìm safety feature theo ID
   */
  async findById(id: string): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel.findById(id).exec();
  }

  /**
   * Tạo safety feature mới
   */
  async create(data: Partial<SafetyFeature>): Promise<SafetyFeatureDocument> {
    const safetyFeature = new this.safetyFeatureModel(data);
    return safetyFeature.save();
  }

  /**
   * Cập nhật thông tin safety feature theo ID
   */
  async updateById(
    id: string,
    updateData: UpdateQuery<SafetyFeature>,
  ): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Đánh dấu xóa safety feature (soft delete)
   */
  async softDelete(
    id: string,
    deletedBy: string,
  ): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel
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
   * Khôi phục safety feature
   */
  async restore(
    id: string,
    updatedBy: string,
  ): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel
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
   * Tìm tất cả safety features với phân trang và lọc
   */
  async findAll(
    query: FilterQuery<SafetyFeatureDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      select?: string;
      populate?: PopulateOptions | (string | PopulateOptions)[];
      includeDeleted?: boolean;
    } = {},
  ): Promise<{
    data: SafetyFeatureDocument[];
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
    const total = await this.safetyFeatureModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.safetyFeatureModel
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
   * Tìm kiếm safety features theo từ khóa
   */
  async search(
    searchTerm: string,
    searchFields: string[] = ['name', 'description'],
    additionalFilters: FilterQuery<SafetyFeatureDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<{
    data: SafetyFeatureDocument[];
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
    const total = await this.safetyFeatureModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.safetyFeatureModel
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
   * Tìm safety feature theo ID và createdBy
   */
  async findByIdAndCreatedBy(
    id: string,
    createdBy: string,
    includeDeleted = false,
  ): Promise<SafetyFeatureDocument | null> {
    const query: FilterQuery<SafetyFeatureDocument> = {
      _id: id,
      createdBy,
    };

    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }

    return this.safetyFeatureModel.findOne(query).exec();
  }

  /**
   * Đếm số lượng safety features với filter
   */
  async count(filter: FilterQuery<SafetyFeature> = {}): Promise<number> {
    return this.safetyFeatureModel.countDocuments(filter).exec();
  }
}
