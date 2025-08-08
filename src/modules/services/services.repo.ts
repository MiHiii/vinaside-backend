import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Service } from './schemas/service.schema';
import { BaseRepo } from '../../database/repo/base.repo';
import { QueryServiceDto } from './dto/query-service.dto';
import { PaginatedServices, ServiceInterface } from './service.interface';
import { Booking } from '../booking/schemas/booking.schema';

@Injectable()
export class ServicesRepo extends BaseRepo<Service> {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<Service>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
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

    return this.serviceModel
      .find({
        isDeleted: false,
        is_active: true,
        ...(Object.keys(priceFilter).length > 0 && {
          default_price: priceFilter,
        }),
      })
      .sort({ default_price: 1 })
      .exec();
  }

  /**
   * Tìm service với filters và pagination
   */
  async findAllWithFilters(
    queryDto: QueryServiceDto,
  ): Promise<PaginatedServices> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeDeleted = false,
      ...filters
    } = queryDto;

    const skip = (page - 1) * limit;
    const filterQuery = this.buildFilterQuery(filters, includeDeleted);

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [services, totalCount] = await Promise.all([
      this.serviceModel
        .find(filterQuery)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.serviceModel.countDocuments(filterQuery),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      services: services as ServiceInterface[],
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
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

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (filters.minPrice !== undefined) {
        priceFilter.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        priceFilter.$lte = filters.maxPrice;
      }
      filterQuery.default_price = priceFilter;
    }

    if (filters.keyword) {
      filterQuery.$or = [
        { name: { $regex: filters.keyword, $options: 'i' } },
        { description: { $regex: filters.keyword, $options: 'i' } },
        { unit: { $regex: filters.keyword, $options: 'i' } },
      ];
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
    interface StatusAggregationResult {
      _id: boolean;
      count: number;
    }

    const results = await this.serviceModel.aggregate<StatusAggregationResult>([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$is_active',
          count: { $sum: 1 },
        },
      },
    ]);

    const active = results.find((r) => r._id === true)?.count || 0;
    const inactive = results.find((r) => r._id === false)?.count || 0;

    return {
      active,
      inactive,
      total: active + inactive,
    };
  }

  /**
   * Lấy service theo thứ tự giá
   */
  async getServicesByPriceOrder(
    order: 'asc' | 'desc' = 'asc',
  ): Promise<Service[]> {
    return this.serviceModel
      .find({
        isDeleted: false,
        is_active: true,
      })
      .sort({ default_price: order === 'asc' ? 1 : -1 })
      .exec();
  }

  /**
   * Tìm service theo unit
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
    return this.serviceModel.aggregate([
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
    ]);
  }

  /**
   * Toggle trạng thái service
   */
  async toggleServiceStatus(
    id: string,
    userId?: string,
  ): Promise<Service | null> {
    const service = await this.serviceModel.findById(id);
    if (!service) return null;

    const updatedService = await this.serviceModel.findByIdAndUpdate(
      id,
      {
        is_active: !service.is_active,
        updated_at: new Date(),
        ...(userId && { updatedBy: new Types.ObjectId(userId) }),
      },
      { new: true },
    );

    return updatedService;
  }

  /**
   * Bulk update trạng thái services
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
    return this.serviceModel.updateMany(
      { _id: { $in: objectIds }, isDeleted: false },
      {
        is_active: isActive,
        updated_at: new Date(),
        ...(userId && { updatedBy: new Types.ObjectId(userId) }),
      },
    );
  }

  /**
   * Tìm service có giá gần giá target
   */
  async findSimilarPriceServices(
    targetPrice: number,
    limit: number = 5,
  ): Promise<Service[]> {
    return this.serviceModel.aggregate([
      {
        $match: {
          isDeleted: false,
          is_active: true,
        },
      },
      {
        $addFields: {
          priceDifference: {
            $abs: { $subtract: ['$default_price', targetPrice] },
          },
        },
      },
      {
        $sort: { priceDifference: 1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          priceDifference: 0, // Remove the temporary field
        },
      },
    ]);
  }

  /**
   * Lấy thống kê chi tiết cho service cụ thể
   */
  async getServiceDetailedStats(
    serviceId: string,
    user?: { role: string; _id: string }, 
    request?: { staffPropertyIds?: string[] },
  ): Promise<
    {
      _id: string;
      service_name: string;
      service_price: number;
      total_bookings: number;
      total_revenue: number;
      average_price: number;
    }[]
  > {
    const matchStage: Record<string, any> = {
      selected_services: { $exists: true, $ne: [] },
      isDeleted: false,
    };

    // Apply staff filter
    if (
      user &&
      user.role === 'staff' &&
      request?.staffPropertyIds &&
      Array.isArray(request.staffPropertyIds)
    ) {
      matchStage.propertyId = {
        $in: request.staffPropertyIds.map(
          (id: string) => new Types.ObjectId(id),
        ),
      };
    }

    return this.bookingModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $unwind: '$selected_services',
      },
      {
        $match: {
          'selected_services.service_id': new Types.ObjectId(serviceId),
        },
      },
      {
        $group: {
          _id: '$selected_services.service_id',
          service_name: { $first: '$selected_services.service_name' },
          service_price: { $first: '$selected_services.service_price' },
          total_bookings: { $sum: 1 },
          total_revenue: { $sum: '$selected_services.total_price' },
        },
      },
      {
        $addFields: {
          total_revenue: { $round: ['$total_revenue', 0] },
          service_price: { $round: ['$service_price', 0] },
          average_price: {
            $cond: {
              if: { $gt: ['$total_bookings', 0] },
              then: {
                $round: [{ $divide: ['$total_revenue', '$total_bookings'] }, 0],
              },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { total_revenue: -1 },
      },
    ]);
  }
}
