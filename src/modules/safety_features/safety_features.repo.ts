import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  UpdateQuery,
  Types,
} from 'mongoose';
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
   * Tìm safety feature active theo ID (không bị xóa)
   */
  async findActiveById(id: string): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
  }

  /**
   * Tìm safety feature đã xóa theo ID
   */
  async findDeletedById(id: string): Promise<SafetyFeatureDocument | null> {
    return this.safetyFeatureModel.findOne({ _id: id, isDeleted: true }).exec();
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
   * Toggle trạng thái is_active
   */
  async toggleStatus(
    id: string,
    updatedBy: string | Types.ObjectId,
  ): Promise<SafetyFeatureDocument | null> {
    const safetyFeature = await this.findActiveById(id);
    if (!safetyFeature) return null;

    const newStatus = !safetyFeature.is_active;
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
  ): Promise<SafetyFeatureDocument | null> {
    const safetyFeature = await this.findActiveById(id);
    if (!safetyFeature) return null;

    const newDefaultStatus = !safetyFeature.default_checked;
    return this.updateById(id, {
      default_checked: newDefaultStatus,
      updatedBy: new Types.ObjectId(updatedBy.toString()),
    });
  }

  /**
   * Tìm tất cả safety features với phân trang và lọc nâng cao
   */
  async findAllWithFilters(
    filters: FilterQuery<SafetyFeatureDocument> = {},
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
    meta: {
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
      sort,
      select,
      populate,
      includeDeleted = false,
    } = options;
    const skip = (page - 1) * limit;

    // Thêm filter loại bỏ các bản ghi bị xóa (trừ khi includeDeleted = true)
    const finalQuery = includeDeleted
      ? filters
      : {
          ...filters,
          isDeleted: { $ne: true },
        };

    // Đếm tổng số bản ghi
    const total = await this.safetyFeatureModel.countDocuments(finalQuery);
    const totalPages = Math.ceil(total / limit);

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
      meta: {
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Tìm kiếm safety features theo từ khóa cho public
   */
  async searchPublic(
    searchTerm: string,
    additionalFilters: FilterQuery<SafetyFeatureDocument> = {},
  ): Promise<{
    data: SafetyFeatureDocument[];
    total: number;
  }> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return { data: [], total: 0 };
    }

    const searchQuery = {
      $or: [
        { name: { $regex: searchTerm.trim(), $options: 'i' } },
        { description: { $regex: searchTerm.trim(), $options: 'i' } },
      ],
    };

    const finalQuery = {
      ...additionalFilters,
      ...searchQuery,
      isDeleted: false,
    };

    const total = await this.safetyFeatureModel.countDocuments(finalQuery);
    const data = await this.safetyFeatureModel
      .find(finalQuery)
      .sort({ created_at: -1 })
      .exec();

    return { data, total };
  }

  /**
   * Tìm tất cả safety features với phân trang và lọc (legacy method)
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
    const result = await this.findAllWithFilters(query, options);
    return {
      data: result.data,
      total: result.total,
    };
  }

  /**
   * Tìm kiếm safety features theo từ khóa (legacy method)
   */
  async search(
    searchTerm: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _searchFields: string[] = ['name', 'description'],
    additionalFilters: FilterQuery<SafetyFeatureDocument> = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<{
    data: SafetyFeatureDocument[];
    total: number;
  }> {
    return this.searchPublic(searchTerm, additionalFilters);
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
