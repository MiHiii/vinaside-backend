import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  UpdateQuery,
  Types,
} from 'mongoose';
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
   * Tìm house rule theo ID chỉ khi active và không bị xóa
   */
  async findActiveById(id: string): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel
      .findOne({
        _id: id,
        is_active: true,
        isDeleted: false,
      })
      .exec();
  }

  /**
   * Tìm house rule đã bị xóa theo ID
   */
  async findDeletedById(id: string): Promise<HouseRuleDocument | null> {
    return this.houseRuleModel
      .findOne({
        _id: id,
        isDeleted: true,
      })
      .exec();
  }

  /**
   * Toggle trạng thái is_active
   */
  async toggleStatus(
    id: string,
    updatedBy: string | Types.ObjectId,
  ): Promise<HouseRuleDocument | null> {
    const houseRule = await this.findById(id);
    if (!houseRule || houseRule.isDeleted) return null;

    const newStatus = !houseRule.is_active;
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
  ): Promise<HouseRuleDocument | null> {
    const houseRule = await this.findById(id);
    if (!houseRule || houseRule.isDeleted) return null;

    const newDefaultStatus = !houseRule.default_checked;
    return this.updateById(id, {
      default_checked: newDefaultStatus,
      updatedBy: new Types.ObjectId(updatedBy.toString()),
    });
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

  /**
   * Lấy house rules cho public (chỉ is_active=true, default_checked=true và isDeleted=false)
   */
  async findAllForPublic(
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
    } = {},
  ): Promise<{
    data: HouseRuleDocument[];
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
      sortBy = 'created_at',
      sortOrder = 'desc',
      search,
    } = options;
    const skip = (page - 1) * limit;

    // Base query cho public: chỉ lấy active, default_checked và không bị xóa
    const query: FilterQuery<HouseRuleDocument> = {
      is_active: true,
      // default_checked: true,
      isDeleted: false,
    };

    // Thêm search nếu có
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

    // Count và execute query
    const total = await this.houseRuleModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const data = await this.houseRuleModel
      .find(query)
      .limit(limit)
      .skip(skip)
      .sort(sort)
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
   * Lấy house rules cho admin (có thể filter theo is_active, default_checked, includeDeleted)
   */
  async findAllForAdmin(
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
      is_active?: boolean;
      default_checked?: boolean;
      includeDeleted?: boolean;
      isDeleted?: boolean;
    } = {},
  ): Promise<{
    data: HouseRuleDocument[];
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
      sortBy = 'created_at',
      sortOrder = 'desc',
      search,
      is_active,
      default_checked,
      includeDeleted = false,
      isDeleted,
    } = options;
    const skip = (page - 1) * limit;

    // Base query cho admin
    const query: FilterQuery<HouseRuleDocument> = {};

    // Logic cho isDeleted filter
    if (typeof isDeleted === 'boolean') {
      // Nếu isDeleted được chỉ định cụ thể, filter theo giá trị đó
      query.isDeleted = isDeleted;
    } else if (includeDeleted) {
      // Nếu includeDeleted = true, lấy tất cả (không filter theo isDeleted)
      // Không thêm filter isDeleted
    } else {
      // Mặc định chỉ lấy những item chưa bị xóa
      query.isDeleted = false;
    }

    // Filter theo is_active nếu được chỉ định
    if (typeof is_active === 'boolean') {
      query.is_active = is_active;
    }

    // Filter theo default_checked nếu được chỉ định
    if (typeof default_checked === 'boolean') {
      query.default_checked = default_checked;
    }

    // Thêm search nếu có
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

    // Count và execute query
    const total = await this.houseRuleModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const data = await this.houseRuleModel
      .find(query)
      .limit(limit)
      .skip(skip)
      .sort(sort)
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
   * Tìm kiếm house rules cho admin (mặc định search tất cả trạng thái)
   */
  async searchAdmin(
    searchTerm: string,
    options: {
      is_active?: boolean;
      default_checked?: boolean;
      includeDeleted?: boolean;
      isDeleted?: boolean;
    } = {},
  ): Promise<{
    data: HouseRuleDocument[];
    total: number;
  }> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return { data: [], total: 0 };
    }

    const {
      is_active,
      default_checked,
      includeDeleted = true,
      isDeleted,
    } = options;

    const searchQuery = {
      $or: [
        { name: { $regex: searchTerm.trim(), $options: 'i' } },
        { description: { $regex: searchTerm.trim(), $options: 'i' } },
      ],
    };

    const finalQuery: FilterQuery<HouseRuleDocument> = {
      ...searchQuery,
    };

    // Logic cho isDeleted filter
    if (typeof isDeleted === 'boolean') {
      // Nếu isDeleted được chỉ định cụ thể, filter theo giá trị đó
      finalQuery.isDeleted = isDeleted;
    } else if (includeDeleted) {
      // Nếu includeDeleted = true, lấy tất cả (không filter theo isDeleted)
      // Không thêm filter isDeleted
    } else {
      // Mặc định chỉ lấy những item chưa bị xóa
      finalQuery.isDeleted = false;
    }

    // Filter theo is_active nếu được chỉ định
    if (typeof is_active === 'boolean') {
      finalQuery.is_active = is_active;
    }

    // Filter theo default_checked nếu được chỉ định
    if (typeof default_checked === 'boolean') {
      finalQuery.default_checked = default_checked;
    }

    const total = await this.houseRuleModel.countDocuments(finalQuery);
    const data = await this.houseRuleModel
      .find(finalQuery)
      .sort({ created_at: -1 })
      .exec();

    return { data, total };
  }

  /**
   * Tìm house rule theo ID cho admin (mặc định lấy tất cả trạng thái)
   */
  async findByIdForAdmin(
    id: string,
    includeDeleted = true,
  ): Promise<HouseRuleDocument | null> {
    const query: FilterQuery<HouseRuleDocument> = {
      _id: id,
    };

    if (!includeDeleted) {
      query.isDeleted = false;
    }

    return this.houseRuleModel.findOne(query).exec();
  }

  /**
   * Lấy thống kê tổng quan house rules
   */
  async getStatistics(
    options: {
      period?: 'day' | 'week' | 'month' | 'year';
      includeDeleted?: boolean;
      includeRecentActivity?: boolean;
      includeTopCreators?: boolean;
    } = {},
  ): Promise<{
    total: number;
    active: number;
    inactive: number;
    defaultChecked: number;
    deleted: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
    byStatus: { active: number; inactive: number };
    byDefaultStatus: { defaultChecked: number; notDefaultChecked: number };
    recentActivity: { date: string; count: number }[];
    topCreators: { userId: string; count: number }[];
  }> {
    const {
      period = 'month',
      includeDeleted = false,
      includeRecentActivity = true,
      includeTopCreators = true,
    } = options;

    // Base filter
    const baseFilter: FilterQuery<HouseRuleDocument> = includeDeleted
      ? {}
      : { isDeleted: { $ne: true } };

    // Các thời điểm reference
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregation pipeline cho basic stats
    const basicStats = await this.houseRuleModel.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$is_active', false] }, 1, 0] },
          },
          defaultChecked: {
            $sum: { $cond: [{ $eq: ['$default_checked', true] }, 1, 0] },
          },
          notDefaultChecked: {
            $sum: { $cond: [{ $eq: ['$default_checked', false] }, 1, 0] },
          },
          deleted: {
            $sum: { $cond: [{ $eq: ['$isDeleted', true] }, 1, 0] },
          },
          createdToday: {
            $sum: {
              $cond: [{ $gte: ['$created_at', today] }, 1, 0],
            },
          },
          createdThisWeek: {
            $sum: {
              $cond: [{ $gte: ['$created_at', thisWeek] }, 1, 0],
            },
          },
          createdThisMonth: {
            $sum: {
              $cond: [{ $gte: ['$created_at', thisMonth] }, 1, 0],
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const stats = basicStats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      defaultChecked: 0,
      notDefaultChecked: 0,
      deleted: 0,
      createdToday: 0,
      createdThisWeek: 0,
      createdThisMonth: 0,
    };

    // Recent Activity (chart data)
    let recentActivity: { date: string; count: number }[] = [];
    if (includeRecentActivity) {
      let periodDays = 30; // default month
      if (period === 'day') periodDays = 1;
      if (period === 'week') periodDays = 7;
      if (period === 'year') periodDays = 365;

      const startDate = new Date(
        now.getTime() - periodDays * 24 * 60 * 60 * 1000,
      );

      recentActivity = await this.houseRuleModel.aggregate([
        {
          $match: {
            ...baseFilter,
            created_at: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$created_at',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            count: 1,
            _id: 0,
          },
        },
      ]);
    }

    // Top Creators
    let topCreators: { userId: string; count: number }[] = [];
    if (includeTopCreators) {
      topCreators = await this.houseRuleModel.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$createdBy',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            userId: { $toString: '$_id' },
            count: 1,
            _id: 0,
          },
        },
      ]);
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      total: stats.total as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      active: stats.active as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      inactive: stats.inactive as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      defaultChecked: stats.defaultChecked as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      deleted: stats.deleted as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      createdToday: stats.createdToday as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      createdThisWeek: stats.createdThisWeek as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      createdThisMonth: stats.createdThisMonth as number,
      byStatus: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        active: stats.active as number,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        inactive: stats.inactive as number,
      },
      byDefaultStatus: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        defaultChecked: stats.defaultChecked as number,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        notDefaultChecked: stats.notDefaultChecked as number,
      },
      recentActivity,
      topCreators,
    };
  }
}
