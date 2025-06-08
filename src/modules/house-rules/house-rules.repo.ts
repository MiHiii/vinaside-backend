import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions, UpdateQuery } from 'mongoose';
import { HouseRule, HouseRuleDocument } from './schemas/house-rule.schema';

@Injectable()
export class HouseRulesRepo {
  constructor(
    @InjectModel(HouseRule.name) private houseRuleModel: Model<HouseRule>,
  ) {}

  /**
   * Tìm house rule theo ID
   */
  async findById(id: string): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel.findById(id).exec();
  }

  /**
   * Tạo house rule mới
   */
  async create(data: Partial<HouseRule>): Promise<HouseRuleDocument> {
    const houseRule = new this.houseRuleModel(data);
    return houseRule.save();
  }

  /**
   * Cập nhật thông tin house rule theo ID
   */
  async updateById(
    id: string,
    updateData: UpdateQuery<HouseRule>,
  ): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Đánh dấu xóa house rule (soft delete)
   */
  async softDelete(
    id: string,
    deletedBy: string,
  ): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel
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
   * Khôi phục house rule
   */
  async restore(
    id: string,
    updatedBy: string,
  ): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel
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
   * Tìm tất cả house rules với phân trang và lọc
   */
  async findAll(
    query: FilterQuery<HouseRuleDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      select?: string;
      populate?: PopulateOptions | (string | PopulateOptions)[];
      includeDeleted?: boolean;
    } = {},
  ): Promise<{
    data: HouseRuleDocument[];
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
    const total = await this.houseRuleModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.houseRuleModel
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
   * Tìm kiếm house rules theo từ khóa
   */
  async search(
    searchTerm: string,
    searchFields: string[] = ['name', 'description'],
    additionalFilters: FilterQuery<HouseRuleDocument> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<{
    data: HouseRuleDocument[];
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
    const total = await this.houseRuleModel.countDocuments(finalQuery);

    // Thực thi query
    const data = await this.houseRuleModel
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
   * Tìm house rule theo ID và createdBy
   */
  async findByIdAndCreatedBy(
    id: string,
    createdBy: string,
    includeDeleted = false,
  ): Promise<HouseRuleDocument | null> {
    const query: FilterQuery<HouseRuleDocument> = {
      _id: id,
      createdBy,
    };

    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }

    return this.houseRuleModel.findOne(query).exec();
  }

  /**
   * Đếm số lượng house rules với filter
   */
  async count(filter: FilterQuery<HouseRule> = {}): Promise<number> {
    return this.houseRuleModel.countDocuments(filter).exec();
  }
}