import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Service } from './schemas/service.schema';
import { BaseRepo } from '../../database/repo/base.repo';
import { QueryServiceDto } from './dto/query-service.dto';
import { PaginatedServices } from './service.interface';

@Injectable()
export class ServicesRepo extends BaseRepo<Service> {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
  ) {
    super(serviceModel);
  }

  /**
   * Tìm service theo tên (case insensitive)
   */
  async findByName(name: string): Promise<Service | null> {
    return this.serviceModel
      .findOne({
        name: { $regex: new RegExp(name, 'i') },
        isDeleted: false,
      })
      .exec();
  }

  /**
   * Kiểm tra tên service đã tồn tại chưa
   */
  async checkNameExists(name: string, excludeId?: string): Promise<boolean> {
    const query: FilterQuery<Service> = {
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isDeleted: false,
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const count = await this.serviceModel.countDocuments(query);
    return count > 0;
  }

  /**
   * Lấy tất cả service đang hoạt động
   */
  async getActiveServices(): Promise<Service[]> {
    return this.serviceModel
      .find({
        isDeleted: false,
        is_active: true,
      })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Tìm service theo khoảng giá
   */
  async findByPriceRange(
    minPrice?: number,
    maxPrice?: number,
  ): Promise<Service[]> {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) {
      priceFilter.$gte = minPrice;
    }
    if (maxPrice !== undefined) {
      priceFilter.$lte = maxPrice;
    }

    const query: FilterQuery<Service> = {
      isDeleted: false,
      is_active: true,
    };

    if (Object.keys(priceFilter).length > 0) {
      query.default_price = priceFilter;
    }

    return this.serviceModel.find(query).sort({ default_price: 1 }).exec();
  }

  /**
   * Lấy service với phân trang và filter phức tạp
   */
  async findAllWithFilters(
    queryDto: QueryServiceDto,
  ): Promise<PaginatedServices> {
    const { page = 1, limit = 10, include_deleted, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    // Build filter query
    const filterQuery = this.buildFilterQuery(filters, include_deleted);

    const [data, total] = await Promise.all([
      this.serviceModel
        .find(filterQuery)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.serviceModel.countDocuments(filterQuery).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Build filter query từ QueryServiceDto
   */
  private buildFilterQuery(
    filters: Partial<QueryServiceDto>,
    includeDeleted: boolean = false,
  ): FilterQuery<Service> {
    const filterQuery: FilterQuery<Service> = {};

    if (!includeDeleted) {
      filterQuery.isDeleted = false;
    }

    if (filters.name) {
      filterQuery.name = { $regex: filters.name, $options: 'i' };
    }

    if (filters.unit) {
      filterQuery.unit = { $regex: filters.unit, $options: 'i' };
    }

    if (filters.is_active !== undefined) {
      filterQuery.is_active = filters.is_active;
    }

    if (filters.min_price !== undefined || filters.max_price !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (filters.min_price !== undefined) {
        priceFilter.$gte = filters.min_price;
      }
      if (filters.max_price !== undefined) {
        priceFilter.$lte = filters.max_price;
      }
      filterQuery.default_price = priceFilter;
    }

    if (filters.search) {
      filterQuery.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { unit: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // Filter theo property_id
    if (filters.property_id) {
      filterQuery.property_id = new Types.ObjectId(filters.property_id);
    }

    // Filter theo room_id
    if (filters.room_id) {
      filterQuery.room_id = new Types.ObjectId(filters.room_id);
    }

    return filterQuery;
  }

  /**
   * Tìm service theo nhiều IDs
   */
  async findByIds(ids: string[]): Promise<Service[]> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    return this.serviceModel
      .find({
        _id: { $in: objectIds },
        isDeleted: false,
      })
      .exec();
  }

  /**
   * Tìm service theo property ID
   */
  async findByProperty(propertyId: string): Promise<Service[]> {
    return this.serviceModel
      .find({
        property_id: new Types.ObjectId(propertyId),
        isDeleted: false,
        is_active: true,
      })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Tìm service theo room ID
   */
  async findByRoom(roomId: string): Promise<Service[]> {
    return this.serviceModel
      .find({
        room_id: new Types.ObjectId(roomId),
        isDeleted: false,
        is_active: true,
      })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Đếm số lượng service theo trạng thái
   */
  async countByStatus(): Promise<{
    active: number;
    inactive: number;
    total: number;
  }> {
    const [active, inactive, total] = await Promise.all([
      this.serviceModel.countDocuments({ isDeleted: false, is_active: true }),
      this.serviceModel.countDocuments({ isDeleted: false, is_active: false }),
      this.serviceModel.countDocuments({ isDeleted: false }),
    ]);

    return { active, inactive, total };
  }

  /**
   * Lấy service có giá cao nhất/thấp nhất
   */
  async getServicesByPriceOrder(
    order: 'asc' | 'desc' = 'asc',
  ): Promise<Service[]> {
    const sortOrder = order === 'asc' ? 1 : -1;
    return this.serviceModel
      .find({
        isDeleted: false,
        is_active: true,
      })
      .sort({ default_price: sortOrder })
      .exec();
  }

  /**
   * Tìm service theo unit (đơn vị)
   */
  async findByUnit(unit: string): Promise<Service[]> {
    return this.serviceModel
      .find({
        unit: { $regex: new RegExp(unit, 'i') },
        isDeleted: false,
        is_active: true,
      })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Thống kê service theo unit
   */
  async getStatsByUnit(): Promise<
    {
      _id: string;
      count: number;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      activeCount: number;
    }[]
  > {
    const results = await this.serviceModel
      .aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$unit',
            count: { $sum: 1 },
            avgPrice: { $avg: '$default_price' },
            minPrice: { $min: '$default_price' },
            maxPrice: { $max: '$default_price' },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
      ])
      .exec();

    return results as {
      _id: string;
      count: number;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      activeCount: number;
    }[];
  }

  /**
   * Toggle status của service
   */
  async toggleServiceStatus(
    id: string,
    userId?: string,
  ): Promise<Service | null> {
    const service = await this.findById(id);
    if (!service) return null;

    return this.updateById(id, { is_active: !service.is_active }, userId);
  }

  /**
   * Bulk update status của nhiều services
   */
  async bulkUpdateStatus(
    ids: string[],
    isActive: boolean,
    userId?: string,
  ): Promise<{
    acknowledged: boolean;
    modifiedCount: number;
    upsertedId: unknown;
    upsertedCount: number;
    matchedCount: number;
  }> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));

    return this.serviceModel
      .updateMany(
        { _id: { $in: objectIds }, isDeleted: false },
        {
          is_active: isActive,
          updatedBy: userId ? new Types.ObjectId(userId) : undefined,
          updated_at: new Date(),
        },
      )
      .exec();
  }

  /**
   * Tìm service có giá gần nhất với giá cho trước
   */
  async findSimilarPriceServices(
    targetPrice: number,
    limit: number = 5,
  ): Promise<Service[]> {
    const results = await this.serviceModel
      .aggregate([
        { $match: { isDeleted: false, is_active: true } },
        {
          $addFields: {
            priceDifference: {
              $abs: { $subtract: ['$default_price', targetPrice] },
            },
          },
        },
        { $sort: { priceDifference: 1 } },
        { $limit: limit },
      ])
      .exec();

    return results as Service[];
  }
}
