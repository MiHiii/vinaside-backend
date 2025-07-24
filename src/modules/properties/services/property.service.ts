/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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
import {
  PropertyVoucherStatistics,
  PropertyServiceStatistics,
  PropertyChartDataPoint,
} from '../dto/property-statistics.dto';
import {
  getDefaultDateRange,
  determineGroupBy,
  getGroupFormat,
  generateLabels,
} from '../../../utils/date.util';

// Aggregation result interfaces
interface ChartAggregationResult {
  _id: { group: string };
  revenue: number;
  bookings: number;
  nights: number;
}

interface MonthlyRevenueResult {
  _id: { year: number; month: number };
  revenue: number;
  bookings: number;
}

interface RevenueByRoomResult {
  _id: Types.ObjectId;
  revenue: number;
  bookings: number;
  totalNights: number;
  listing: { title: string };
  averageRevenuePerNight: number;
}

interface GuestStatsResult {
  totalUniqueGuests: number;
  returningGuests: number;
  averageSpentPerGuest: number;
  averageStayDurationAcrossGuests: number;
}

interface ReviewAnalysisResult {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: number[];
}

interface VoucherStatsResult {
  _id: string;
  usageCount: number;
  totalDiscount: number;
}

interface VoucherUsageByMonthResult {
  _id: { year: number; month: number };
  vouchersUsed: number;
  totalDiscount: number;
}

interface ServiceStatsResult {
  _id: Types.ObjectId;
  serviceName: string;
  usageCount: number;
  revenue: number;
}

interface ServiceUsageByMonthResult {
  _id: { year: number; month: number };
  servicesUsed: number;
  revenue: number;
}

export interface PaginatedProperties {
  data: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PropertyService {
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
  ) {}

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
      staffIds:
        createPropertyDto.staffIds?.map((id) => new Types.ObjectId(id)) || [],
    };

    const property = new this.propertyModel(propertyData);
    return property.save();
  }

  async findAll(queryDto: QueryPropertyDto): Promise<PaginatedProperties> {
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
        .find(filterQuery)
        .populate('staffIds', 'name email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(filterQuery),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async findOne(id: string): Promise<Property> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Định dạng ID tài sản không hợp lệ');
    }

    const property = await this.propertyModel
      .findOne({ _id: id, isDeleted: false })
      .populate('staffIds', 'name email phone')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async findByStaff(
    staffId: string,
    queryDto: QueryPropertyDto,
  ): Promise<PaginatedProperties> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;

    const filterQuery: FilterQuery<PropertyDocument> = {
      isDeleted: false,
      staffIds: new Types.ObjectId(staffId),
    };

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.propertyModel
        .find(filterQuery)
        .populate('staffIds', 'name email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.propertyModel.countDocuments(filterQuery),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<Property> {
    // Create a mutable update object
    const updateData: { [key: string]: any } = { ...updatePropertyDto };

    // Convert staffIds to ObjectIds if provided
    if (updateData.staffIds && Array.isArray(updateData.staffIds)) {
      updateData.staffIds = (updateData.staffIds as string[]).map(
        (staffId) => new Types.ObjectId(staffId),
      );
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('staffIds', 'name email')
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
      .populate('staffIds', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async verify(id: string, isVerified: boolean): Promise<Property> {
    const property = await this.propertyModel
      .findByIdAndUpdate(id, { isVerified }, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!property) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return property;
  }

  async updateStatus(id: string, status: string): Promise<Property> {
    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('staffIds', 'name email')
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    return updatedProperty;
  }

  async assignStaff(id: string, staffIds: string[]): Promise<Property> {
    const objectIdStaffIds = staffIds.map((id) => new Types.ObjectId(id));

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, { staffIds: objectIdStaffIds }, { new: true })
      .populate('staffIds', 'name email')
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
   * Lấy thống kê chi tiết cho một property cụ thể
   */
  async getPropertyStatistics(
    propertyId: string,
    startDate?: string,
    endDate?: string,
    groupBy?: string,
  ) {
    // Validate property exists
    const property = await this.findOne(propertyId);

    // Sử dụng 7 ngày gần nhất nếu không có ngày được chỉ định
    let actualStartDate: Date | undefined;
    let actualEndDate: Date | undefined;

    if (!startDate && !endDate) {
      const defaultRange = getDefaultDateRange();
      actualStartDate = defaultRange.startDate;
      actualEndDate = defaultRange.endDate;
    } else {
      if (startDate) actualStartDate = new Date(startDate);
      if (endDate) actualEndDate = new Date(endDate);
    }

    const finalGroupBy = determineGroupBy(
      actualStartDate!,
      actualEndDate!,
      groupBy,
    );
    const { format: groupFormat, labelFn } = getGroupFormat(finalGroupBy);

    // Lấy dữ liệu cho biểu đồ
    const chartMatch: any = {
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
      status: { $in: ['confirmed', 'completed'] },
    };
    if (actualStartDate || actualEndDate) {
      chartMatch.created_at = {};
      if (actualStartDate) chartMatch.created_at.$gte = actualStartDate;
      if (actualEndDate) chartMatch.created_at.$lte = actualEndDate;
    }

    const chartDataAgg =
      await this.bookingModel.aggregate<ChartAggregationResult>([
        { $match: chartMatch },
        {
          $group: {
            _id: {
              group: {
                $dateToString: { format: groupFormat, date: '$created_at' },
              },
            },
            revenue: { $sum: '$final_amount' },
            bookings: { $sum: 1 },
            nights: { $sum: '$nights' },
          },
        },
        { $sort: { '_id.group': 1 } },
      ]);

    // Chuẩn hóa dữ liệu cho biểu đồ
    const labelMap = new Map<
      string,
      { revenue: number; bookings: number; nights: number }
    >();
    chartDataAgg.forEach((item) => {
      labelMap.set(item._id.group, {
        revenue: item.revenue,
        bookings: item.bookings,
        nights: item.nights,
      });
    });

    const labels = generateLabels(
      actualStartDate!,
      actualEndDate!,
      finalGroupBy,
    );
    const chartData: PropertyChartDataPoint[] = labels.map((label) => {
      const data = labelMap.get(label) || {
        revenue: 100,
        bookings: 30,
        nights: 10,
      };
      return {
        label: labelFn(label),
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: data.nights > 0 ? 100 : 0,
      };
    });

    // Create date filter sử dụng cùng khoảng thời gian
    const dateFilter: { created_at?: { $gte?: Date; $lte?: Date } } = {};
    if (actualStartDate || actualEndDate) {
      dateFilter.created_at = {};
      if (actualStartDate) dateFilter.created_at.$gte = actualStartDate;
      if (actualEndDate) dateFilter.created_at.$lte = actualEndDate;
    }

    // Get all listings for this property
    const allListings = await this.listingModel.find({
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
    });

    const listingIds = allListings.map((listing) => listing._id);

    // Get all bookings for this property with date filter
    const allBookings = await this.bookingModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isDeleted: false,
        ...dateFilter,
      })
      .sort({ checkInDate: 1 });

    // 1. Tổng quan phòng (listings)
    const totalRooms = allListings.length;
    const activeRooms = allListings.filter(
      (l) =>
        l.status === ListingStatus.ACTIVE ||
        l.status === ListingStatus.VERIFIED,
    ).length;

    // Rooms with at least 1 booking
    const bookedRoomIds = [
      ...new Set(allBookings.map((b) => b.listingId.toString())),
    ];
    const roomsWithBookings = bookedRoomIds.length;
    const roomsWithoutBookings = totalRooms - roomsWithBookings;

    // 2. Hiệu suất đặt phòng
    const totalBookings = allBookings.length;
    const successfulBookings = allBookings.filter(
      (b) =>
        b.status === BookingStatus.CONFIRMED ||
        b.status === BookingStatus.COMPLETED,
    ).length;
    const cancelledBookings = allBookings.filter(
      (b) => b.status === BookingStatus.CANCELLED,
    ).length;
    const cancellationRate =
      totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

    // Calculate occupancy rate
    const today = new Date();
    const currentDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const confirmedBookings = allBookings.filter(
      (b) =>
        b.status === BookingStatus.CONFIRMED ||
        b.status === BookingStatus.COMPLETED,
    );

    let totalPossibleNights = 0;
    let bookedNights = 0;

    if (confirmedBookings.length > 0) {
      const earliestBooking = confirmedBookings[0];
      const latestBooking = confirmedBookings[confirmedBookings.length - 1];
      const startDate = new Date(earliestBooking.checkInDate);
      const endDate = new Date(
        Math.max(latestBooking.check_out_date.getTime(), currentDate.getTime()),
      );

      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      totalPossibleNights = totalDays * activeRooms;
      bookedNights = confirmedBookings.reduce(
        (sum, booking) => sum + booking.nights,
        0,
      );
    }

    const averageOccupancyRate =
      totalPossibleNights > 0 ? (bookedNights / totalPossibleNights) * 100 : 0;

    // 3. Doanh thu và giá
    const paidBookings = allBookings.filter(
      (b) => b.payment_status === PaymentStatus.PAID,
    );
    const totalRevenue = paidBookings.reduce(
      (sum, booking) => sum + booking.final_amount,
      0,
    );

    // Monthly revenue
    const monthlyRevenue =
      await this.bookingModel.aggregate<MonthlyRevenueResult>([
        {
          $match: {
            propertyId: new Types.ObjectId(propertyId),
            payment_status: 'paid',
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$checkInDate' },
              month: { $month: '$checkInDate' },
            },
            revenue: { $sum: '$final_amount' },
            bookings: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 },
        },
      ]);

    // Average price per night
    const totalNightsBooked = paidBookings.reduce(
      (sum, booking) => sum + booking.nights,
      0,
    );
    const averagePricePerNight =
      totalNightsBooked > 0 ? totalRevenue / totalNightsBooked : 0;

    // Revenue by room
    const revenueByRoom =
      await this.bookingModel.aggregate<RevenueByRoomResult>([
        {
          $match: {
            propertyId: new Types.ObjectId(propertyId),
            payment_status: 'paid',
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$listingId',
            revenue: { $sum: '$final_amount' },
            bookings: { $sum: 1 },
            totalNights: { $sum: '$nights' },
          },
        },
        {
          $lookup: {
            from: 'listings',
            localField: '_id',
            foreignField: '_id',
            as: 'listing',
          },
        },
        {
          $unwind: '$listing',
        },
        {
          $addFields: {
            averageRevenuePerNight: {
              $cond: [
                { $gt: ['$totalNights', 0] },
                { $divide: ['$revenue', '$totalNights'] },
                0,
              ],
            },
          },
        },
      ]);

    // 4. Thống kê thời gian
    let earliestBookingDate: Date | null = null;
    let latestBookingDate: Date | null = null;
    let averageStayDuration = 0;

    if (allBookings.length > 0) {
      earliestBookingDate = allBookings[0].checkInDate;
      latestBookingDate = allBookings[allBookings.length - 1].check_out_date;
      averageStayDuration =
        allBookings.reduce((sum, booking) => sum + booking.nights, 0) /
        allBookings.length;
    }

    // 5. Thống kê khách hàng
    const guestStats = await this.bookingModel.aggregate<GuestStatsResult>([
      {
        $match: {
          propertyId: new Types.ObjectId(propertyId),
          payment_status: 'paid',
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$guestId',
          bookings: { $sum: 1 },
          totalSpent: { $sum: '$final_amount' },
          totalNights: { $sum: '$nights' },
          averageStayDuration: { $avg: '$nights' },
        },
      },
      {
        $group: {
          _id: null,
          totalUniqueGuests: { $sum: 1 },
          returningGuests: {
            $sum: { $cond: [{ $gt: ['$bookings', 1] }, 1, 0] },
          },
          averageSpentPerGuest: { $avg: '$totalSpent' },
          averageStayDurationAcrossGuests: { $avg: '$averageStayDuration' },
        },
      },
    ]);

    const customerInsights: GuestStatsResult = guestStats[0] || {
      totalUniqueGuests: 0,
      returningGuests: 0,
      averageSpentPerGuest: 0,
      averageStayDurationAcrossGuests: 0,
    };

    // 6. Thống kê review
    const reviewAnalysis =
      await this.reviewModel.aggregate<ReviewAnalysisResult>([
        {
          $match: {
            room_id: { $in: listingIds },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratingBreakdown: {
              $push: '$rating',
            },
          },
        },
      ]);

    const reviewData: ReviewAnalysisResult = reviewAnalysis[0] || {
      totalReviews: 0,
      averageRating: 0,
      ratingBreakdown: [],
    };

    // Tính phân bố rating
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (reviewData.ratingBreakdown) {
      reviewData.ratingBreakdown.forEach((rating: number) => {
        if (rating >= 1 && rating <= 5) {
          ratingDistribution[rating as keyof typeof ratingDistribution]++;
        }
      });
    }

    // 7. Get voucher and service statistics
    const voucherStatistics = await this.getVoucherStatistics(
      propertyId,
      dateFilter,
    );
    const serviceStatistics = await this.getServiceStatistics(
      propertyId,
      dateFilter,
    );

    return {
      propertyId,
      propertyName: property.name,
      overview: {
        totalRooms,
        activeRooms,
        roomsWithBookings,
        roomsWithoutBookings,
        utilizationRate:
          totalRooms > 0 ? (roomsWithBookings / totalRooms) * 100 : 0,
      },
      bookingPerformance: {
        totalBookings,
        successfulBookings,
        cancelledBookings,
        successRate:
          totalBookings > 0 ? (successfulBookings / totalBookings) * 100 : 0,
        cancellationRate: Math.round(cancellationRate),
        averageOccupancyRate: Math.round(averageOccupancyRate),
      },
      revenueAndPricing: {
        totalRevenue,
        averagePricePerNight: Math.round(averagePricePerNight),
        monthlyRevenue: monthlyRevenue.map((item) => ({
          month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          revenue: item.revenue,
          bookings: item.bookings,
        })),
        revenueByRoom: revenueByRoom.map((item) => ({
          listingId: item._id,
          listingTitle: item.listing.title,
          revenue: item.revenue,
          bookings: item.bookings,
          totalNights: item.totalNights,
          averageRevenuePerNight: Math.round(item.averageRevenuePerNight),
        })),
      },
      timeStatistics: {
        earliestBookingDate,
        latestBookingDate,
        averageStayDuration: Math.round(averageStayDuration * 10) / 10,
      },
      customerInsights: {
        totalUniqueGuests: customerInsights.totalUniqueGuests,
        returningGuests: customerInsights.returningGuests,
        newGuestRate:
          customerInsights.totalUniqueGuests > 0
            ? Math.round(
                ((customerInsights.totalUniqueGuests -
                  customerInsights.returningGuests) /
                  customerInsights.totalUniqueGuests) *
                  100,
              )
            : 0,
        returningGuestRate:
          customerInsights.totalUniqueGuests > 0
            ? Math.round(
                (customerInsights.returningGuests /
                  customerInsights.totalUniqueGuests) *
                  100,
              )
            : 0,
        averageSpentPerGuest: Math.round(customerInsights.averageSpentPerGuest),
        averageStayDuration:
          Math.round(customerInsights.averageStayDurationAcrossGuests * 10) /
          10,
      },
      reviewAnalysis: {
        totalReviews: reviewData.totalReviews,
        averageRating: Math.round(reviewData.averageRating * 10) / 10,
        ratingDistribution,
      },
      voucherStatistics,
      serviceStatistics,
      chartData,
    };
  }

  /**
   * Lấy thống kê voucher cho property
   */
  private async getVoucherStatistics(
    propertyId: string,
    dateFilter: { created_at?: { $gte?: Date; $lte?: Date } },
  ): Promise<PropertyVoucherStatistics> {
    // Thống kê voucher usage từ booking metadata
    const voucherStats = await this.bookingModel.aggregate<VoucherStatsResult>([
      {
        $match: {
          propertyId: new Types.ObjectId(propertyId),
          isDeleted: false,
          'metadata.voucherCode': { $exists: true, $ne: null },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$metadata.voucherCode',
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: { $ifNull: ['$metadata.discountAmount', 0] } },
        },
      },
      {
        $sort: { usageCount: -1 },
      },
    ]);

    // Thống kê voucher theo tháng
    const voucherUsageByMonth =
      await this.bookingModel.aggregate<VoucherUsageByMonthResult>([
        {
          $match: {
            propertyId: new Types.ObjectId(propertyId),
            isDeleted: false,
            'metadata.voucherCode': { $exists: true, $ne: null },
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' },
            },
            vouchersUsed: { $sum: 1 },
            totalDiscount: {
              $sum: { $ifNull: ['$metadata.discountAmount', 0] },
            },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 },
        },
      ]);

    const totalVouchersUsed = voucherStats.reduce(
      (sum, voucher) => sum + voucher.usageCount,
      0,
    );
    const totalDiscountAmount = voucherStats.reduce(
      (sum, voucher) => sum + voucher.totalDiscount,
      0,
    );

    return {
      totalVouchersUsed,
      totalDiscountAmount,
      averageDiscountPerBooking:
        totalVouchersUsed > 0 ? totalDiscountAmount / totalVouchersUsed : 0,
      mostPopularVoucher: voucherStats.length > 0 ? voucherStats[0]._id : 'N/A',
      voucherUsageByMonth: voucherUsageByMonth.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        vouchersUsed: item.vouchersUsed,
        totalDiscount: item.totalDiscount,
      })),
      topVouchers: voucherStats.slice(0, 10).map((voucher) => ({
        voucherCode: voucher._id,
        usageCount: voucher.usageCount,
        totalDiscount: voucher.totalDiscount,
      })),
    };
  }

  /**
   * Lấy thống kê service cho property
   */
  private async getServiceStatistics(
    propertyId: string,
    dateFilter: { created_at?: { $gte?: Date; $lte?: Date } },
  ): Promise<PropertyServiceStatistics> {
    // Thống kê service usage từ transactions hoặc booking metadata
    const serviceStats = await this.bookingModel.aggregate<ServiceStatsResult>([
      {
        $match: {
          propertyId: new Types.ObjectId(propertyId),
          isDeleted: false,
          'metadata.services': { $exists: true, $ne: [] },
          ...dateFilter,
        },
      },
      {
        $unwind: '$metadata.services',
      },
      {
        $group: {
          _id: '$metadata.services.serviceId',
          serviceName: { $first: '$metadata.services.serviceName' },
          usageCount: { $sum: 1 },
          revenue: { $sum: '$metadata.services.price' },
        },
      },
      {
        $sort: { usageCount: -1 },
      },
    ]);

    // Thống kê service theo tháng
    const serviceUsageByMonth =
      await this.bookingModel.aggregate<ServiceUsageByMonthResult>([
        {
          $match: {
            propertyId: new Types.ObjectId(propertyId),
            isDeleted: false,
            'metadata.services': { $exists: true, $ne: [] },
            ...dateFilter,
          },
        },
        {
          $unwind: '$metadata.services',
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' },
            },
            servicesUsed: { $sum: 1 },
            revenue: { $sum: '$metadata.services.price' },
          },
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 },
        },
      ]);

    const totalServices = serviceStats.length;
    const totalServiceRevenue = serviceStats.reduce(
      (sum, service) => sum + service.revenue,
      0,
    );

    return {
      totalServices,
      activeServices: totalServices, // Giả định tất cả services được sử dụng đều active
      totalServiceRevenue,
      averageServicePrice:
        totalServices > 0 ? totalServiceRevenue / totalServices : 0,
      mostPopularService:
        serviceStats.length > 0 ? serviceStats[0].serviceName : 'N/A',
      serviceUsageByMonth: serviceUsageByMonth.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        servicesUsed: item.servicesUsed,
        revenue: item.revenue,
      })),
      topServices: serviceStats.slice(0, 10).map((service) => ({
        serviceName: service.serviceName,
        usageCount: service.usageCount,
        revenue: service.revenue,
      })),
    };
  }

  async getRoomStatus(propertyId: string) {
    const listings = await this.listingModel.find({
      propertyId,
      isDeleted: false,
    });
    const today = new Date();
    const result = await Promise.all(
      listings.map(async (listing) => {
        const booking = await this.bookingModel.findOne({
          listingId: listing._id,
          isDeleted: false,
          status: { $in: ['confirmed', 'pending'] },
          checkInDate: { $lte: today },
          check_out_date: { $gt: today },
        });
        return {
          listingId: listing._id,
          title: listing.title,
          images: listing.images,
          price_per_night: listing.price_per_night,
          status: booking ? 'booked' : 'available',
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
      const property = await this.findOne(propertyId);

      interface PopulatedStaff {
        _id?: Types.ObjectId;
        toString?: () => string;
      }

      interface PopulatedProperty {
        staffIds: PopulatedStaff[];
      }
      const p = property as unknown as PopulatedProperty;

      const isStaff =
        p.staffIds?.some((staff) => {
          // Handle both populated objects and ObjectIds
          const staffIdStr = staff?._id
            ? staff._id.toString()
            : staff && typeof staff.toString === 'function'
              ? staff.toString()
              : '';
          return staffIdStr === userId;
        }) || false;

      return isStaff;
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách property IDs mà user được gán làm staff
   */
  async getStaffPropertyIds(staffId: string): Promise<string[]> {
    const properties = await this.propertyModel
      .find({
        staffIds: staffId,
        isDeleted: false,
      })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();

    return properties.map((property) => property._id.toString());
  }
}
