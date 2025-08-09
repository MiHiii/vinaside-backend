/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

import { Property, PropertyDocument } from '../schemas/property.schema';
import { Listing, ListingStatus } from '../../listing/schemas/listing.schema';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../../booking/schemas/booking.schema';
import { Review } from '../../reviews/schemas/review.schema';
import { Voucher } from '../../vouchers/schemas/voucher.schema';
import { Service } from '../../services/schemas/service.schema';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { QueryPropertyDto } from '../dto/query-property.dto';
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';
import { GooglePlacesService } from '../../location/google-places.service';
import { PropertyStaffAssignmentService } from '../../property-staff-assignment/property-staff-assignment.service';
import {
  applyStaffFilter,
  createEmptyResult,
  RequestWithStaffFilter,
} from '../../../utils/staff-filter.util';
import {
  PropertyStatisticsQueryDto,
  PropertyStatisticsResponseDto,
  PropertyChartDataPoint,
  PropertyDateRange,
  DateRangeType,
  PropertyBookingPerformance,
  PropertyOccupancyStats,
  PropertyVoucherStats,
  PropertyServiceStats,
  PropertyReviewStats,
} from '../dto/property-statistics.dto';
import {
  getDefaultDateRange,
  determineGroupBy,
  getGroupFormat,
  generateLabels,
} from '../../../utils/date.util';

export interface PaginatedProperties {
  data: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PropertyService {
  /**
   * Lấy danh sách tất cả phòng trong property (public)
   */
  async getPropertyRooms(
    propertyId: string,
    queryDto: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;

    // Kiểm tra property có tồn tại không
    const property = await this.propertyModel.findById(propertyId);
    if (!property) {
      throw new NotFoundException(
        `Property với ID ${propertyId} không tồn tại`,
      );
    }

    // Lấy danh sách phòng - chỉ filter isDeleted: false như getRoomStatus
    const [listings, total] = await Promise.all([
      this.listingModel
        .find({
          propertyId: new Types.ObjectId(propertyId),
          isDeleted: false, // Chỉ filter này, không filter status
        })
        .populate([
          { path: 'amenities', select: 'name icon' },
          { path: 'house_rules_selected', select: 'name description' },
          { path: 'safety_features', select: 'name icon' },
          { path: 'service_ids', select: 'name price' },
        ])
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.listingModel.countDocuments({
        propertyId: new Types.ObjectId(propertyId),
        isDeleted: false, // Chỉ filter này, không filter status
      }),
    ]);

    return {
      property: {
        id: property._id,
        name: property.name,
        type: property.type,
        description: property.description,
        thumbnail: property.thumbnail,
        images: property.images,
        location: property.location,
      },
      rooms: listings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / (limit || 1)),
      },
    };
  }
  constructor(
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    @InjectModel(Listing.name)
    private listingModel: Model<Listing>,
    @InjectModel(Booking.name)
    private bookingModel: Model<Booking>,
    @InjectModel(Review.name)
    private reviewModel: Model<Review>,
    @InjectModel(Voucher.name)
    private voucherModel: Model<Voucher>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
    private googlePlacesService: GooglePlacesService,
    private propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {
    this.logger = new Logger(PropertyService.name);
  }

  private readonly logger: Logger;

  async create(
    createPropertyDto: CreatePropertyDto,
    user: JwtPayload,
  ): Promise<Property> {
    // Validate place_id if provided
    if (createPropertyDto.location.place_id) {
      const placeDetails = await this.googlePlacesService.getPlaceDetails(
        createPropertyDto.location.place_id,
      );

      if (!placeDetails) {
        throw new Error(
          `Invalid place_id: ${createPropertyDto.location.place_id}`,
        );
      }

      // Optionally update coordinates from place details if they don't match
      if (placeDetails.geometry) {
        createPropertyDto.location.lat = placeDetails.geometry.location.lat;
        createPropertyDto.location.lng = placeDetails.geometry.location.lng;
      }
    }

    const propertyData = {
      ...createPropertyDto,
      createdBy: new Types.ObjectId(user._id),
    };

    const property = new this.propertyModel(propertyData);
    return property.save();
  }

  async findAll(
    queryDto: QueryPropertyDto,
    user?: JwtPayload,
    request?: RequestWithStaffFilter,
  ): Promise<PaginatedProperties> {
    try {
      this.logger.log('PropertyService.findAll called with:', {
        queryDto,
        user: user ? { id: user._id, role: user.role } : null,
        staffPropertyIds: request?.staffPropertyIds,
      });
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        ...filters
      } = queryDto;
      const skip = (page - 1) * limit;

      // Build filter object with proper typing
      const filterQuery: FilterQuery<PropertyDocument> = { isDeleted: false };

      // Apply staff filtering using utility function
      const filteredQuery = applyStaffFilter(filterQuery, request, '_id');

      // If staff has no assigned properties, return empty result
      if (
        user?.role === 'staff' &&
        (!request?.staffPropertyIds || request.staffPropertyIds.length === 0)
      ) {
        return createEmptyResult(page, limit);
      }

      if (filters.keyword) {
        filterQuery.$text = { $search: filters.keyword };
      }

      if (filters.type) {
        filterQuery.type = filters.type;
      }

      if (filters.status) {
        filterQuery.status = filters.status;
      }

      if (filters.isVerified !== undefined) {
        filterQuery.isVerified = filters.isVerified;
      }

      if (filters.city) {
        filterQuery['location.city'] = new RegExp(filters.city, 'i');
      }

      if (filters.district) {
        filterQuery['location.district'] = new RegExp(filters.district, 'i');
      }

      if (filters.name && typeof filters.name === 'string') {
        const nameStr = String(filters.name);
        if (nameStr.trim()) {
          filterQuery.name = { $regex: nameStr, $options: 'i' };
        }
      }

      // Geospatial search
      if (filters.lat && filters.lng && filters.radius) {
        filterQuery['location.lat'] = {
          $gte: filters.lat - filters.radius / 111, // Approximate conversion
          $lte: filters.lat + filters.radius / 111,
        };
        filterQuery['location.lng'] = {
          $gte:
            filters.lng -
            filters.radius / (111 * Math.cos((filters.lat * Math.PI) / 180)),
          $lte:
            filters.lng +
            filters.radius / (111 * Math.cos((filters.lat * Math.PI) / 180)),
        };
      }

      // Build sort object with proper typing
      const sortObj: Record<string, 1 | -1> = {};
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        this.propertyModel
          .find(filteredQuery)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.propertyModel.countDocuments(filteredQuery),
      ]);

      const result = {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / (limit || 1)),
      };

      this.logger.log('PropertyService.findAll result:', {
        total,
        page,
        limit,
        totalPages: result.totalPages,
        propertiesCount: data.length,
      });

      return result;
    } catch (error) {
      this.logger.error('PropertyService.findAll error:', error);
      throw error;
    }
  }

  async findOne(id: string): Promise<Property> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Định dạng ID tài sản không hợp lệ');
    }

    const property = await this.propertyModel
      .findOne({ _id: id, isDeleted: false })
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<Property> {
    // Create a mutable update object
    const updateData: { [key: string]: any } = { ...updatePropertyDto };

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async remove(id: string): Promise<void> {
    await this.propertyModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }

  async restore(id: string, user: JwtPayload): Promise<Property> {
    // Only admin can restore
    if (user.role !== 'admin') {
      throw new ForbiddenException('Chỉ admin mới có thể khôi phục tài sản');
    }

    const property = await this.propertyModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: false,
          $unset: { deletedAt: 1 },
        },
        { new: true },
      )
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async verify(id: string, isVerified: boolean): Promise<Property> {
    const property = await this.propertyModel
      .findByIdAndUpdate(id, { isVerified }, { new: true })
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async updateStatus(id: string, status: string): Promise<Property> {
    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async findNearby(
    lat: number,
    lng: number,
    radius: number = 10,
    queryDto: Omit<QueryPropertyDto, 'lat' | 'lng' | 'radius'> = {},
  ): Promise<Property[]> {
    return this.findAll({ ...queryDto, lat, lng, radius }).then(
      (result) => result.data,
    );
  }

  async getStats() {
    const [total, active, pending, verified, byType] = await Promise.all([
      this.propertyModel.countDocuments({ isDeleted: false }),
      this.propertyModel.countDocuments({ isDeleted: false, status: 'active' }),
      this.propertyModel.countDocuments({
        isDeleted: false,
        status: 'pending',
      }),
      this.propertyModel.countDocuments({ isDeleted: false, isVerified: true }),
      this.propertyModel.aggregate<{ _id: string; count: number }>([
        { $match: { isDeleted: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      active,
      pending,
      verified,
      byType: byType.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as { [key: string]: number },
      ),
    };
  }

  /**
   * Lấy thống kê chi tiết cho một property cụ thể với date range filter
   *
   * @param propertyId - ID của property
   * @param queryDto - Query parameters cho date range filter
   * @param user - User thực hiện request (để check permission)
   * @param request - Request object (để check staff filter)
   * @returns Property statistics object with schema:
   */
  async getPropertyStatistics(
    propertyId: string,
    queryDto: PropertyStatisticsQueryDto,
    user?: JwtPayload,
    request?: { staffPropertyIds?: string[] },
  ): Promise<PropertyStatisticsResponseDto> {
    // Validate property exists and staff access
    const property = await this.findOne(propertyId);

    // Apply staff filter if needed
    if (
      user &&
      user.role === 'staff' &&
      request?.staffPropertyIds &&
      Array.isArray(request.staffPropertyIds)
    ) {
      if (!request.staffPropertyIds.includes(propertyId)) {
        throw new ForbiddenException(
          'Staff không có quyền xem thống kê của property này',
        );
      }
    }

    // Get date range from query (similar to dashboard service)
    const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);
    const dateFilter = {
      created_at: { $gte: startDate, $lte: endDate },
    };

    // Base match condition for all queries
    const baseMatch = {
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
      ...dateFilter,
    };

    // Get listings info
    const totalListings = await this.listingModel.countDocuments({
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
    });

    const activeListings = await this.listingModel.countDocuments({
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
      status: { $in: ['active', 'verified'] },
    });

    // Get all bookings for detailed analysis
    const allBookings = await this.bookingModel.find(baseMatch);
    const paidBookings = allBookings.filter((b) => b.payment_status === 'paid');
    const totalRevenue = paidBookings.reduce(
      (sum, booking) => sum + booking.final_amount,
      0,
    );

    // Get unique users count
    const uniqueUsers = [
      ...new Set(allBookings.map((b) => b.guestId?.toString()).filter(Boolean)),
    ];
    const totalUsers = uniqueUsers.length;

    // 1. Booking Performance Statistics
    const bookingPerformance: PropertyBookingPerformance =
      await this.getBookingPerformance(baseMatch);

    // 2. Occupancy Statistics (similar to dashboard)
    const occupancyStats: PropertyOccupancyStats = await this.getOccupancyStats(
      propertyId,
      activeListings,
      startDate,
      endDate,
      baseMatch,
    );

    // 3. Voucher Statistics
    const voucherStats: PropertyVoucherStats =
      await this.getVoucherStats(baseMatch);

    // 4. Service Statistics
    const serviceStats: PropertyServiceStats =
      await this.getServiceStats(baseMatch);

    // 5. Review Statistics
    const reviewStats: PropertyReviewStats =
      await this.getReviewStats(propertyId);

    // 6. Chart data - revenue by date (similar to dashboard)
    const chartData: PropertyChartDataPoint[] = await this.getChartData(
      baseMatch,
      startDate,
      endDate,
    );

    return {
      propertyId,
      propertyName: property.name,
      totalListings,
      activeListings,
      totalRevenue: Math.round(totalRevenue),
      totalUsers,
      bookingPerformance,
      occupancyStats,
      voucherStats,
      serviceStats,
      reviewStats,
      chartData,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Get booking performance statistics
   */
  private async getBookingPerformance(
    baseMatch: any,
  ): Promise<PropertyBookingPerformance> {
    const bookingStats = await this.bookingModel.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$final_amount' },
          totalNights: { $sum: '$nights' },
        },
      },
    ]);

    const stats = {
      totalBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      completedBookings: 0,
      totalAmount: 0,
      totalNights: 0,
    };

    bookingStats.forEach((item) => {
      stats.totalBookings += item.count;
      stats.totalAmount += item.totalAmount;
      stats.totalNights += item.totalNights;

      switch (item._id) {
        case 'confirmed':
          stats.confirmedBookings = item.count;
          break;
        case 'cancelled':
          stats.cancelledBookings = item.count;
          break;
        case 'completed':
          stats.completedBookings = item.count;
          break;
      }
    });

    const bookingSuccessRate =
      stats.totalBookings > 0
        ? ((stats.confirmedBookings + stats.completedBookings) /
            stats.totalBookings) *
          100
        : 0;

    const cancellationRate =
      stats.totalBookings > 0
        ? (stats.cancelledBookings / stats.totalBookings) * 100
        : 0;

    const averageBookingValue =
      stats.totalBookings > 0 ? stats.totalAmount / stats.totalBookings : 0;

    const averageStayDuration =
      stats.totalBookings > 0 ? stats.totalNights / stats.totalBookings : 0;

    return {
      totalBookings: stats.totalBookings,
      confirmedBookings: stats.confirmedBookings,
      cancelledBookings: stats.cancelledBookings,
      completedBookings: stats.completedBookings,
      bookingSuccessRate: Math.round(bookingSuccessRate * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue),
      averageStayDuration: Math.round(averageStayDuration * 100) / 100,
    };
  }

  /**
   * Get occupancy statistics (similar to dashboard logic)
   */
  private async getOccupancyStats(
    propertyId: string,
    activeListings: number,
    startDate: Date,
    endDate: Date,
    baseMatch: any,
  ): Promise<PropertyOccupancyStats> {
    // Calculate total possible nights
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    const totalPossibleNights = totalDays * activeListings;

    // Get total booked nights (consistent with dashboard logic - no status filter)
    const bookedNightsResult = await this.bookingModel.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalBookedNights: { $sum: '$nights' },
        },
      },
    ]);

    const totalBookedNights = bookedNightsResult[0]?.totalBookedNights || 0;

    // Calculate occupancy rate
    const occupancyRate =
      totalPossibleNights > 0
        ? (totalBookedNights / totalPossibleNights) * 100
        : 0;

    // Calculate average advance booking days
    const advanceBookingResult = await this.bookingModel.aggregate([
      { $match: baseMatch },
      {
        $project: {
          advanceDays: {
            $divide: [
              { $subtract: ['$checkInDate', '$created_at'] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageAdvanceBookingDays: { $avg: '$advanceDays' },
        },
      },
    ]);

    const averageAdvanceBookingDays =
      advanceBookingResult[0]?.averageAdvanceBookingDays || 0;

    return {
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      totalPossibleNights,
      totalBookedNights,
      averageAdvanceBookingDays:
        Math.round(averageAdvanceBookingDays * 100) / 100,
    };
  }

  /**
   * Get voucher statistics with top vouchers
   */
  private async getVoucherStats(baseMatch: any): Promise<PropertyVoucherStats> {
    const voucherResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          voucher_id: { $exists: true, $ne: null },
          voucher_discount_amount: { $exists: true, $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalVouchersUsed: { $sum: 1 },
          totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
        },
      },
    ]);

    const voucherStats = voucherResult[0] || {
      totalVouchersUsed: 0,
      totalVoucherDiscount: 0,
    };

    // Get top vouchers
    const topVouchersResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          voucher_id: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$voucher_id',
          voucherCode: { $first: '$voucher_code' },
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: '$voucher_discount_amount' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 5 },
    ]);

    const topVouchers = topVouchersResult.map((item) => ({
      voucherId: item._id.toString(),
      voucherCode: item.voucherCode || 'N/A',
      usageCount: item.usageCount,
      totalDiscount: Math.round(item.totalDiscount || 0),
    }));

    // Calculate rates
    const totalBookingsCount =
      await this.bookingModel.countDocuments(baseMatch);
    const voucherUsageRate =
      totalBookingsCount > 0
        ? (voucherStats.totalVouchersUsed / totalBookingsCount) * 100
        : 0;

    const averageVoucherDiscount =
      voucherStats.totalVouchersUsed > 0
        ? voucherStats.totalVoucherDiscount / voucherStats.totalVouchersUsed
        : 0;

    return {
      totalVouchersUsed: voucherStats.totalVouchersUsed,
      totalVoucherDiscount: Math.round(voucherStats.totalVoucherDiscount),
      averageVoucherDiscount: Math.round(averageVoucherDiscount),
      voucherUsageRate: Math.round(voucherUsageRate * 100) / 100,
      topVouchers,
    };
  }

  /**
   * Get service statistics with top services
   */
  private async getServiceStats(baseMatch: any): Promise<PropertyServiceStats> {
    const serviceResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          selected_services: { $exists: true, $ne: [] },
        },
      },
      {
        $unwind: '$selected_services',
      },
      {
        $group: {
          _id: null,
          totalServicesUsed: { $sum: 1 },
          serviceRevenue: { $sum: '$selected_services.total_price' },
        },
      },
    ]);

    const serviceStats = serviceResult[0] || {
      totalServicesUsed: 0,
      serviceRevenue: 0,
    };

    // Get top services
    const topServicesResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          selected_services: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$selected_services' },
      {
        $group: {
          _id: '$selected_services.service_id',
          serviceName: { $first: '$selected_services.service_name' },
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: '$selected_services.total_price' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 5 },
    ]);

    const topServices = topServicesResult.map((item) => ({
      serviceId: item._id.toString(),
      serviceName: item.serviceName || 'N/A',
      usageCount: item.usageCount,
      totalRevenue: Math.round(item.totalRevenue),
    }));

    // Calculate average services per booking
    const totalBookingsWithServices = await this.bookingModel.countDocuments({
      ...baseMatch,
      selected_services: { $exists: true, $ne: [] },
    });

    const averageServicesPerBooking =
      totalBookingsWithServices > 0
        ? serviceStats.totalServicesUsed / totalBookingsWithServices
        : 0;

    return {
      totalServicesUsed: serviceStats.totalServicesUsed,
      serviceRevenue: Math.round(serviceStats.serviceRevenue),
      averageServicesPerBooking:
        Math.round(averageServicesPerBooking * 100) / 100,
      topServices,
    };
  }

  /**
   * Get review statistics
   */
  private async getReviewStats(
    propertyId: string,
  ): Promise<PropertyReviewStats> {
    // Get all listing IDs for this property
    const listings = await this.listingModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isDeleted: false,
      })
      .select('_id');

    const listingIds = listings.map((l) => l._id);

    const reviewResult = await this.reviewModel.aggregate([
      {
        $match: {
          room_id: { $in: listingIds },
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: { $push: '$rating' },
        },
      },
    ]);

    if (!reviewResult[0]) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const reviewData = reviewResult[0];

    // Calculate rating distribution
    const ratingDistribution: { [rating: number]: number } = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    reviewData.ratings.forEach((rating: number) => {
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }
    });

    return {
      totalReviews: reviewData.totalReviews,
      averageRating: Math.round(reviewData.averageRating * 100) / 100,
      ratingDistribution,
    };
  }

  /**
   * Get chart data for revenue by date
   */
  private async getChartData(
    baseMatch: any,
    startDate: Date,
    endDate: Date,
  ): Promise<PropertyChartDataPoint[]> {
    const chartDataResult = await this.bookingModel.aggregate([
      {
        $match: {
          ...baseMatch,
          payment_status: 'paid',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
          },
          totalRevenue: { $sum: '$final_amount' },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1,
        },
      },
    ]);

    // Create a map of existing revenue data
    const revenueMap = new Map<string, number>();
    chartDataResult.forEach((item) => {
      const date = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      revenueMap.set(date, item.totalRevenue);
    });

    // Generate complete date range with zero values for missing dates
    const chartData: PropertyChartDataPoint[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        totalRevenue: Math.round(revenueMap.get(dateStr) || 0),
      });
      current.setDate(current.getDate() + 1);
    }

    return chartData;
  }

  /**
   * Helper method to get date range from query DTO (similar to dashboard service)
   */
  private getDateRangeFromQuery(queryDto: PropertyStatisticsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    switch (queryDto.dateRange) {
      case DateRangeType.TODAY:
        return {
          startDate: today,
          endDate: todayEnd,
        };

      case DateRangeType.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(
          today.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: sevenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_15_DAYS: {
        const fifteenDaysAgo = new Date(
          today.getTime() - 15 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: fifteenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.CUSTOM:
        if (queryDto.startDate && queryDto.endDate) {
          return {
            startDate: new Date(queryDto.startDate + 'T00:00:00.000Z'),
            endDate: new Date(queryDto.endDate + 'T23:59:59.999Z'),
          };
        }
        // Fall back to last 30 days if custom dates are not provided
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };

      default:
        // Default to last 30 days
        const defaultThirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: defaultThirtyDaysAgo,
          endDate: todayEnd,
        };
    }
  }

  /**
   * Lấy trạng thái phòng của property (đang đặt/còn trống), bao gồm cả phòng INACTIVE
   *
   * @param propertyId - ID của property
   * @returns Array of room status objects with schema:
   * - listingId: string - ID của listing
   * - propertyId: object - Thông tin property đã populate
   *   - _id: string - ID của property
   *   - name: string - Tên property
   *   - type: string - Loại property
   *   - location: object - Thông tin vị trí property
   * - title: string - Tiêu đề phòng
   * - images: string[] - Danh sách ảnh phòng
   * - price_per_night: number - Giá theo đêm
   * - has_weekend_surcharge: boolean - Có phụ thu cuối tuần
   * - weekend_surcharge_percent: number - Phần trăm phụ thu cuối tuần
   * - status: 'available' | 'booked' | 'reserved' - Trạng thái booking của phòng
   * - listingStatus: 'active' | 'inactive' | 'draft' - Trạng thái hiển thị của listing
   */
  async getRoomStatus(propertyId: string) {
    const listings = await this.listingModel
      .find({
        propertyId,
        isDeleted: false,
      })
      .populate({
        path: 'propertyId',
        select: 'name type location',
      });
    // Lấy ngày hiện tại theo giờ Việt Nam (UTC+7) và chuyển thành yyyy-mm-dd
    function toVNDateString(date: Date) {
      const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      return vn.toISOString().slice(0, 10); // yyyy-mm-dd
    }
    const vnTodayStr = toVNDateString(new Date());
    const result = await Promise.all(
      listings.map(async (listing) => {
        // Tìm booking confirmed trong khoảng ngày hiện tại (so sánh yyyy-mm-dd, giờ VN)
        const confirmed = await this.bookingModel.findOne({
          listingId: listing._id,
          isDeleted: false,
          status: 'confirmed',
          $expr: {
            $and: [
              {
                $lte: [
                  {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$checkInDate',
                      timezone: '+07:00',
                    },
                  },
                  vnTodayStr,
                ],
              },
              {
                $gt: [
                  {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$check_out_date',
                      timezone: '+07:00',
                    },
                  },
                  vnTodayStr,
                ],
              },
            ],
          },
        });
        let status = 'available';
        if (confirmed) {
          status = 'reserved';
        } else {
          // Tìm booking pending trong khoảng ngày hiện tại (so sánh yyyy-mm-dd, giờ VN)
          const pending = await this.bookingModel.findOne({
            listingId: listing._id,
            isDeleted: false,
            status: 'pending',
            $expr: {
              $and: [
                {
                  $lte: [
                    {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$checkInDate',
                        timezone: '+07:00',
                      },
                    },
                    vnTodayStr,
                  ],
                },
                {
                  $gt: [
                    {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$check_out_date',
                        timezone: '+07:00',
                      },
                    },
                    vnTodayStr,
                  ],
                },
              ],
            },
          });
          if (pending) status = 'booked';
        }
        return {
          listingId: listing._id,
          propertyId: listing.propertyId, // Populated property object
          title: listing.title,
          images: listing.images,
          price_per_night: listing.price_per_night,
          has_weekend_surcharge: listing.has_weekend_surcharge,
          weekend_surcharge_percent: listing.weekend_surcharge_percent,
          status,
          listingStatus: listing.status, // Listing display status (active/inactive/draft)
        };
      }),
    );
    return result;
  }

  // ================== PUBLIC UTILITY METHODS FOR OTHER SERVICES ==================

  /**
   * Kiểm tra user có phải staff của property không
   */
  async isUserStaffOfProperty(
    propertyId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      return await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
        new Types.ObjectId(userId),
        new Types.ObjectId(propertyId),
      );
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách property IDs mà user được gán làm staff
   */
  async getStaffPropertyIds(staffId: string): Promise<string[]> {
    const assignments =
      await this.propertyStaffAssignmentService.getPropertiesByStaff(
        new Types.ObjectId(staffId),
      );

    return assignments.map((assignment) => assignment.propertyId.toString());
  }
}
