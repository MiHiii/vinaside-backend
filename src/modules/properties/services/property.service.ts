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
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { QueryPropertyDto } from '../dto/query-property.dto';
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';

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
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    user: JwtPayload,
  ): Promise<Property> {
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
   * Get comprehensive statistics for a specific property
   */
  async getPropertyStatistics(propertyId: string) {
    // Validate property exists
    const property = await this.findOne(propertyId);

    // Get all listings for this property
    const allListings = await this.listingModel.find({
      propertyId: new Types.ObjectId(propertyId),
      isDeleted: false,
    });

    const listingIds = allListings.map((listing) => listing._id);

    // Get all bookings for this property
    const allBookings = await this.bookingModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isDeleted: false,
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
    const monthlyRevenue = await this.bookingModel.aggregate([
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
    const revenueByRoom = await this.bookingModel.aggregate([
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
        $project: {
          listingId: '$_id',
          listingTitle: '$listing.title',
          revenue: 1,
          bookings: 1,
          totalNights: 1,
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

    // Peak booking days
    const bookingsByDate = await this.bookingModel.aggregate([
      {
        $match: {
          propertyId: new Types.ObjectId(propertyId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$checkInDate' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // 5. Khách hàng
    const uniqueCustomers = [
      ...new Set(allBookings.map((b) => b.guestId.toString())),
    ].length;

    // Return customers calculation
    const customerBookingCounts = await this.bookingModel.aggregate([
      {
        $match: {
          propertyId: new Types.ObjectId(propertyId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$guestId',
          bookingCount: { $sum: 1 },
        },
      },
    ]);

    const returnCustomers = customerBookingCounts.filter(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (c: any) => (c.bookingCount as number) > 1,
    ).length;
    const returnCustomerRate =
      uniqueCustomers > 0 ? (returnCustomers / uniqueCustomers) * 100 : 0;

    // 6. Thống kê đánh giá (Reviews)
    const allReviews = await this.reviewModel.find({
      room_id: { $in: listingIds },
    });

    const totalReviews = allReviews.length;
    const averagePropertyRating =
      totalReviews > 0
        ? allReviews.reduce((sum, review) => sum + review.rating, 0) /
          totalReviews
        : 0;

    // Rating distribution cho toàn bộ property (array format for charts)
    const ratingDistribution = [
      { rating: 1, count: allReviews.filter((r) => r.rating === 1).length },
      { rating: 2, count: allReviews.filter((r) => r.rating === 2).length },
      { rating: 3, count: allReviews.filter((r) => r.rating === 3).length },
      { rating: 4, count: allReviews.filter((r) => r.rating === 4).length },
      { rating: 5, count: allReviews.filter((r) => r.rating === 5).length },
    ];

    // Reviews by room
    const reviewsByRoom = await this.reviewModel.aggregate([
      {
        $match: {
          room_id: { $in: listingIds },
        },
      },
      {
        $group: {
          _id: '$room_id',
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: { $push: '$rating' },
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
        $project: {
          listingId: '$_id',
          listingTitle: '$listing.title',
          totalReviews: 1,
          averageRating: { $round: ['$averageRating', 1] },
          ratingCounts: {
            1: {
              $size: {
                $filter: { input: '$ratings', cond: { $eq: ['$$this', 1] } },
              },
            },
            2: {
              $size: {
                $filter: { input: '$ratings', cond: { $eq: ['$$this', 2] } },
              },
            },
            3: {
              $size: {
                $filter: { input: '$ratings', cond: { $eq: ['$$this', 3] } },
              },
            },
            4: {
              $size: {
                $filter: { input: '$ratings', cond: { $eq: ['$$this', 4] } },
              },
            },
            5: {
              $size: {
                $filter: { input: '$ratings', cond: { $eq: ['$$this', 5] } },
              },
            },
          },
        },
      },
      {
        $sort: { averageRating: -1 },
      },
    ]);

    // Recent reviews
    const recentReviews = await this.reviewModel
      .find({
        room_id: { $in: listingIds },
      })
      .populate('user_id', 'name avatar')
      .populate('room_id', 'title')
      .sort({ created_at: -1 })
      .limit(10);

    return {
      propertyInfo: {
        id: propertyId,
        name: property.name,
        description: property.description,
        thumbnail: property.thumbnail,
        images: property.images || [],
        location: property.location,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        createdAt: (property as any).createdAt as Date, // Timestamps field from Mongoose
      },

      // 1. Tổng quan phòng
      roomOverview: {
        totalRooms,
        activeRooms,
        roomsWithBookings,
        roomsWithoutBookings,
        roomUtilizationRate:
          totalRooms > 0 ? (roomsWithBookings / totalRooms) * 100 : 0,
      },

      // 2. Hiệu suất đặt phòng
      bookingPerformance: {
        totalBookings,
        successfulBookings,
        cancelledBookings,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
        successRate:
          totalBookings > 0
            ? Math.round((successfulBookings / totalBookings) * 100 * 100) / 100
            : null,
      },

      // 3. Doanh thu và giá
      revenueAndPricing: {
        totalRevenue: Math.round(totalRevenue),
        monthlyRevenue: monthlyRevenue.map((m: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          year: m._id.year as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          month: m._id.month as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          monthKey: `${m._id.year as number}-${(m._id.month as number).toString().padStart(2, '0')}`, // "2025-07" format
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          revenue: Math.round(m.revenue as number),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          bookings: m.bookings as number,
        })),
        averagePricePerNight: Math.round(averagePricePerNight),
        totalNightsBooked,
        revenueByRoom: revenueByRoom.map((r: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          listingId: r.listingId as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          listingTitle: r.listingTitle as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          revenue: Math.round(r.revenue as number),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          bookings: r.bookings as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          totalNights: r.totalNights as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          averageRevenuePerNight: Math.round(
            r.averageRevenuePerNight as number,
          ),
        })),
      },

      // 4. Thống kê thời gian
      timeStatistics: {
        earliestBookingDate,
        latestBookingDate,
        averageStayDuration: Math.round(averageStayDuration * 10) / 10, // 1 chữ số thập phân
        averageStayDurationText:
          averageStayDuration > 0
            ? `${Math.round(averageStayDuration * 10) / 10} nights`
            : null,
        peakBookingDays: bookingsByDate.map((d: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          date: d._id as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          bookingCount: d.count as number,
        })),
      },

      // 5. Khách hàng
      customerStatistics: {
        uniqueCustomers,
        returnCustomers,
        returnCustomerRate: Math.round(returnCustomerRate * 100) / 100,
        newCustomers: uniqueCustomers - returnCustomers,
        averageBookingsPerCustomer:
          uniqueCustomers > 0
            ? Math.round((totalBookings / uniqueCustomers) * 100) / 100
            : 0,
      },

      // 6. Thống kê đánh giá
      reviewStatistics: {
        totalReviews,
        averagePropertyRating: Math.round(averagePropertyRating * 10) / 10,
        ratingDistribution,
        reviewsByRoom: reviewsByRoom.map((room: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          listingId: room.listingId as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          listingTitle: room.listingTitle as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          totalReviews: room.totalReviews as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          averageRating: room.averageRating as number,
          ratingDistribution: [
            {
              rating: 1,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              count: ((room.ratingCounts as any)[1] as number) || 0,
            },

            {
              rating: 2,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              count: ((room.ratingCounts as any)[2] as number) || 0,
            },

            {
              rating: 3,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              count: ((room.ratingCounts as any)[3] as number) || 0,
            },

            {
              rating: 4,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              count: ((room.ratingCounts as any)[4] as number) || 0,
            },

            {
              rating: 5,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              count: ((room.ratingCounts as any)[5] as number) || 0,
            },
          ],
        })),
        recentReviews: recentReviews.map((review: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          id: review._id as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          rating: review.rating as number,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          comment: review.comment as string,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          createdAt: review.created_at as Date,
          // Flattened user info
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          userName: (review.user_id?.name as string) || 'Unknown',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          userAvatar: (review.user_id?.avatar as string) || null,
          // Flattened listing info
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          listingId: (review.room_id as any)?._id as string,
          listingTitle: (review.room_id?.title as string) || 'Unknown Room',
          // Nested structure vẫn có (optional cho flexibility)
          user: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            name: (review.user_id?.name as string) || 'Unknown',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            avatar: (review.user_id?.avatar as string) || null,
          },
          listing: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            id: (review.room_id as any)?._id as string,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            title: (review.room_id?.title as string) || 'Unknown Room',
          },
        })),
        roomsWithReviews: reviewsByRoom.length,
        roomsWithoutReviews: totalRooms - reviewsByRoom.length,
        reviewCoverage:
          totalRooms > 0 ? (reviewsByRoom.length / totalRooms) * 100 : 0,
      },
    };
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
    try {
      const staffProperties = await this.findByStaff(staffId, {});
      interface PropertyWithId {
        _id: Types.ObjectId;
      }
      return staffProperties.data.map((prop) =>
        (prop as unknown as PropertyWithId)._id.toString(),
      );
    } catch {
      return [];
    }
  }
}
