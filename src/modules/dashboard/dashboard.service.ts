import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';
import { Listing } from '../listing/schemas/listing.schema';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../booking/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Voucher } from '../vouchers/schemas/voucher.schema';
import { Service } from '../services/schemas/service.schema';
import { Message } from '../messages/schemas/message.schema';
import {
  DashboardStatistics,
  DashboardChartGroupBy,
} from './dto/dashboard-statistics';
import {
  getDefaultDateRange,
  determineGroupBy,
  getGroupFormat,
  generateLabels,
} from '../../utils/date.util';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Listing.name) private listingModel: Model<Listing>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    @InjectModel(Voucher.name) private voucherModel: Model<Voucher>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async getDashboardStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    groupBy?: string,
  ): Promise<DashboardStatistics> {
    try {
      const { startDate: start, endDate: end } = getDefaultDateRange();
      const dateFilter = {
        created_at: { $gte: start, $lte: end },
      };

      // 1. Overview Statistics
      const overview = await this.getOverviewStatistics(dateFilter, propertyId);

      // 2. Financial Statistics
      const financial = await this.getFinancialStatistics(
        dateFilter,
        propertyId,
      );

      // 3. Customer Statistics
      const customers = await this.getCustomerStatistics(
        dateFilter,
        propertyId,
      );

      // 4. Timeline Statistics
      const timeline = await this.getTimelineStatistics(
        dateFilter,
        propertyId,
        groupBy,
      );

      // 5. Performance Statistics
      const performance = await this.getPerformanceStatistics(
        dateFilter,
        propertyId,
      );

      // 6. Real-time Statistics
      const realTime = await this.getRealTimeStatistics();

      return {
        overview,
        financial,
        customers,
        timeline,
        performance,
        realTime,
      };
    } catch (error) {
      this.logger.error('Error getting dashboard statistics:', error);
      throw error;
    }
  }

  private async getOverviewStatistics(dateFilter: any, propertyId?: string) {
    const propertyFilter = propertyId
      ? { property_id: new Types.ObjectId(propertyId) }
      : {};

    const [
      userStats,
      propertyStats,
      listingStats,
      bookingStats,
      reviewStats,
      voucherStats,
      serviceStats,
      messageStats,
    ] = await Promise.all([
      // User statistics
      this.userModel.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            usersByRole: {
              $push: {
                role: '$role',
                count: 1,
              },
            },
          },
        },
      ]),

      // Property statistics
      this.propertyModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalProperties: { $sum: 1 },
            activeProperties: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            verifiedProperties: {
              $sum: { $cond: ['$isVerified', 1, 0] },
            },
            propertiesByStatus: {
              $push: {
                status: '$status',
                count: 1,
              },
            },
          },
        },
      ]),

      // Listing statistics
      this.listingModel.aggregate([
        { $match: { ...propertyFilter, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalListings: { $sum: 1 },
            activeListings: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            averagePricePerNight: { $avg: '$price_per_night' },
            listingsByStatus: {
              $push: {
                status: '$status',
                count: 1,
              },
            },
          },
        },
      ]),

      // Booking statistics
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' },
            averageBookingValue: { $avg: '$total_amount' },
            bookingsByStatus: {
              $push: {
                status: '$status',
                count: 1,
              },
            },
          },
        },
      ]),

      // Review statistics
      this.reviewModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratingDistribution: {
              $push: {
                rating: '$rating',
                count: 1,
              },
            },
          },
        },
      ]),

      // Voucher statistics
      this.voucherModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalVouchers: { $sum: 1 },
            activeVouchers: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$is_active', true] },
                      { $gte: ['$expiration_date', new Date()] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            usedVouchers: {
              $sum: { $cond: [{ $gt: ['$uses_count', 0] }, 1, 0] },
            },
            totalVoucherDiscount: { $sum: '$discount_amount' },
          },
        },
      ]),

      // Service statistics
      this.serviceModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalServices: { $sum: 1 },
            activeServices: {
              $sum: { $cond: ['$is_active', 1, 0] },
            },
          },
        },
      ]),

      // Message statistics
      this.messageModel.aggregate([
        { $match: { ...dateFilter } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            totalReactions: { $sum: { $size: '$reactions' } },
          },
        },
      ]),
    ]);

    // Process user role distribution
    const userRoleMap = { guest: 0, staff: 0, admin: 0 };
    if (userStats[0]?.usersByRole) {
      userStats[0].usersByRole.forEach((item: any) => {
        userRoleMap[item.role] = (userRoleMap[item.role] || 0) + item.count;
      });
    }

    // Process property status distribution
    const propertyStatusMap = { active: 0, inactive: 0, pending: 0 };
    if (propertyStats[0]?.propertiesByStatus) {
      propertyStats[0].propertiesByStatus.forEach((item: any) => {
        propertyStatusMap[item.status] =
          (propertyStatusMap[item.status] || 0) + item.count;
      });
    }

    // Process listing status distribution
    const listingStatusMap = { active: 0, inactive: 0, draft: 0 };
    if (listingStats[0]?.listingsByStatus) {
      listingStats[0].listingsByStatus.forEach((item: any) => {
        listingStatusMap[item.status] =
          (listingStatusMap[item.status] || 0) + item.count;
      });
    }

    // Process booking status distribution
    const bookingStatusMap = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      rejected: 0,
    };
    if (bookingStats[0]?.bookingsByStatus) {
      bookingStats[0].bookingsByStatus.forEach((item: any) => {
        bookingStatusMap[item.status] =
          (bookingStatusMap[item.status] || 0) + item.count;
      });
    }

    // Process rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (reviewStats[0]?.ratingDistribution) {
      reviewStats[0].ratingDistribution.forEach((item: any) => {
        ratingDistribution[item.rating] =
          (ratingDistribution[item.rating] || 0) + item.count;
      });
    }

    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersLast30Days = await this.userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get total conversations (unique sender-receiver pairs)
    const totalConversations = await this.messageModel.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $lt: ['$sender_id', '$receiver_id'] },
              { sender: '$sender_id', receiver: '$receiver_id' },
              { sender: '$receiver_id', receiver: '$sender_id' },
            ],
          },
        },
      },
      { $count: 'total' },
    ]);

    return {
      totalUsers: userStats[0]?.totalUsers || 0,
      usersByRole: userRoleMap,
      newUsersLast30Days,
      totalProperties: propertyStats[0]?.totalProperties || 0,
      activeProperties: propertyStats[0]?.activeProperties || 0,
      verifiedProperties: propertyStats[0]?.verifiedProperties || 0,
      propertiesByStatus: propertyStatusMap,
      totalListings: listingStats[0]?.totalListings || 0,
      activeListings: listingStats[0]?.activeListings || 0,
      averagePricePerNight: listingStats[0]?.averagePricePerNight || 0,
      listingsByStatus: listingStatusMap,
      totalBookings: bookingStats[0]?.totalBookings || 0,
      totalRevenue: bookingStats[0]?.totalRevenue || 0,
      averageBookingValue: bookingStats[0]?.averageBookingValue || 0,
      bookingsByStatus: bookingStatusMap,
      totalReviews: reviewStats[0]?.totalReviews || 0,
      averageRating: reviewStats[0]?.averageRating || 0,
      ratingDistribution,
      totalVouchers: voucherStats[0]?.totalVouchers || 0,
      activeVouchers: voucherStats[0]?.activeVouchers || 0,
      usedVouchers: voucherStats[0]?.usedVouchers || 0,
      totalVoucherDiscount: voucherStats[0]?.totalVoucherDiscount || 0,
      totalServices: serviceStats[0]?.totalServices || 0,
      activeServices: serviceStats[0]?.activeServices || 0,
      totalServicesRevenue: 0, // Will be calculated in financial stats
      totalMessages: messageStats[0]?.totalMessages || 0,
      totalConversations: totalConversations[0]?.total || 0,
      totalReactions: messageStats[0]?.totalReactions || 0,
    };
  }

  private async getFinancialStatistics(dateFilter: any, propertyId?: string) {
    const propertyFilter = propertyId
      ? { property_id: new Types.ObjectId(propertyId) }
      : {};

    const [
      totalRevenue,
      totalServiceFees,
      totalTaxAmount,
      totalRefunds,
      voucherFinancialData,
      servicesFinancialData,
      revenueByMonth,
      topPropertiesByRevenue,
    ] = await Promise.all([
      // Total revenue
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: null, total: { $sum: '$final_amount' } } },
      ]),

      // Service fees
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$metadata.serviceFees', 0] } },
          },
        },
      ]),

      // Tax amount
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$metadata.taxAmount', 0] } },
          },
        },
      ]),

      // Refunds
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            payment_status: 'refunded',
            ...dateFilter,
          },
        },
        { $group: { _id: null, total: { $sum: '$final_amount' } } },
      ]),

      // Voucher discount
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$metadata.discountAmount', 0] } },
          },
        },
      ]),

      // Services revenue
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$metadata.services.price', 0] } },
          },
        },
      ]),

      // Revenue by month
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: {
              year: { $year: '$checkInDate' },
              month: { $month: '$checkInDate' },
            },
            revenue: { $sum: '$final_amount' },
            bookings: { $sum: 1 },
            voucherDiscount: {
              $sum: { $ifNull: ['$metadata.discountAmount', 0] },
            },
            servicesRevenue: {
              $sum: { $ifNull: ['$metadata.services.price', 0] },
            },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      // Top properties by revenue
      this.bookingModel.aggregate([
        { $match: { payment_status: 'paid', ...dateFilter } },
        {
          $lookup: {
            from: 'listings',
            localField: 'listingId',
            foreignField: '_id',
            as: 'listing',
          },
        },
        { $unwind: '$listing' },
        {
          $lookup: {
            from: 'properties',
            localField: 'listing.propertyId',
            foreignField: '_id',
            as: 'property',
          },
        },
        { $unwind: '$property' },
        {
          $group: {
            _id: '$property._id',
            propertyName: { $first: '$property.name' },
            revenue: { $sum: '$final_amount' },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const totalRevenueAmount = totalRevenue[0]?.total || 0;
    const totalVoucherDiscount = voucherFinancialData[0]?.total || 0;
    const totalServicesRevenue = servicesFinancialData[0]?.total || 0;

    return {
      totalRevenue: totalRevenueAmount,
      totalServiceFees: totalServiceFees[0]?.total || 0,
      totalTaxAmount: totalTaxAmount[0]?.total || 0,
      totalRefunds: totalRefunds[0]?.total || 0,
      netRevenue: totalRevenueAmount - (totalRefunds[0]?.total || 0),
      totalVoucherDiscount,
      totalRevenueBeforeVoucher: totalRevenueAmount + totalVoucherDiscount,
      voucherDiscountPercentage:
        totalRevenueAmount > 0
          ? (totalVoucherDiscount / totalRevenueAmount) * 100
          : 0,
      totalServicesRevenue,
      servicesRevenuePercentage:
        totalRevenueAmount > 0
          ? (totalServicesRevenue / totalRevenueAmount) * 100
          : 0,
      revenueByMonth: revenueByMonth.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        revenue: item.revenue,
        bookings: item.bookings,
        voucherDiscount: item.voucherDiscount,
        servicesRevenue: item.servicesRevenue,
      })),
      topPropertiesByRevenue: topPropertiesByRevenue.map((item) => ({
        propertyId: item._id.toString(),
        propertyName: item.propertyName,
        revenue: item.revenue,
        bookings: item.bookings,
      })),
    };
  }

  private async getCustomerStatistics(dateFilter: any, propertyId?: string) {
    const propertyFilter = propertyId
      ? { property_id: new Types.ObjectId(propertyId) }
      : {};

    const [
      totalCustomers,
      newCustomers,
      returningCustomers,
      averageNightsPerBooking,
      averageGuestsPerBooking,
      customersUsingVouchers,
      customersUsingServices,
      topCustomers,
      averageRating,
      totalReviews,
      positiveReviews,
      negativeReviews,
    ] = await Promise.all([
      // Total customers
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: '$guestId' } },
        { $count: 'total' },
      ]),

      // New customers (last 30 days)
      this.userModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        { $count: 'total' },
      ]),

      // Returning customers
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: '$guestId', totalBookings: { $sum: 1 } } },
        { $match: { totalBookings: { $gt: 1 } } },
        { $count: 'total' },
      ]),

      // Average nights per booking
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: null, average: { $avg: '$nights' } } },
      ]),

      // Average guests per booking
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: null, average: { $avg: '$guests' } } },
      ]),

      // Customers using vouchers
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            payment_status: 'paid',
            'metadata.voucherCode': { $exists: true, $ne: null },
            ...dateFilter,
          },
        },
        { $group: { _id: '$guestId' } },
        { $count: 'total' },
      ]),

      // Customers using services
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            payment_status: 'paid',
            'metadata.services': { $exists: true, $ne: [] },
            ...dateFilter,
          },
        },
        { $group: { _id: '$guestId' } },
        { $count: 'total' },
      ]),

      // Top customers
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        {
          $group: {
            _id: '$guestId',
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$final_amount' },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            customerId: '$_id',
            customerName: { $concat: ['$user.name', ' ', '$user.username'] },
            totalBookings: 1,
            totalSpent: 1,
          },
        },
      ]),

      // Average rating
      this.reviewModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        { $group: { _id: null, average: { $avg: '$rating' } } },
      ]),

      // Total reviews
      this.reviewModel.countDocuments({ ...propertyFilter, ...dateFilter }),

      // Positive reviews (4-5 stars)
      this.reviewModel.countDocuments({
        ...propertyFilter,
        ...dateFilter,
        rating: { $gte: 4 },
      }),

      // Negative reviews (1-2 stars)
      this.reviewModel.countDocuments({
        ...propertyFilter,
        ...dateFilter,
        rating: { $lte: 2 },
      }),
    ]);

    return {
      totalCustomers: totalCustomers[0]?.total || 0,
      newCustomers: newCustomers[0]?.total || 0,
      returningCustomers: returningCustomers[0]?.total || 0,
      averageNightsPerBooking: averageNightsPerBooking[0]?.average || 0,
      averageGuestsPerBooking: averageGuestsPerBooking[0]?.average || 0,
      customersUsingVouchers: customersUsingVouchers[0]?.total || 0,
      customersUsingServices: customersUsingServices[0]?.total || 0,
      topCustomers: topCustomers.map((item) => ({
        customerId: item.customerId.toString(),
        customerName: item.customerName,
        totalBookings: item.totalBookings,
        totalSpent: item.totalSpent,
      })),
      averageRating: averageRating[0]?.average || 0,
      totalReviews,
      positiveReviews,
      negativeReviews,
    };
  }

  private async getTimelineStatistics(
    dateFilter: any,
    propertyId?: string,
    groupBy?: string,
  ) {
    const propertyFilter = propertyId
      ? { property_id: new Types.ObjectId(propertyId) }
      : {};

    const [
      bookingsByDay,
      bookingsByWeek,
      bookingsByMonth,
      newUsersByMonth,
      newPropertiesByMonth,
      reviewsByMonth,
    ] = await Promise.all([
      // Bookings by day
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$checkInDate' },
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$final_amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Bookings by week
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%U', date: '$checkInDate' },
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$final_amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Bookings by month
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$checkInDate' },
            },
            bookings: { $sum: 1 },
            revenue: { $sum: '$final_amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // New users by month
      this.userModel.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' },
            },
            newUsers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // New properties by month
      this.propertyModel.aggregate([
        { $match: { isDeleted: false, ...propertyFilter } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' },
            },
            newProperties: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Reviews by month
      this.reviewModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$created_at' },
            },
            reviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      bookingsByDay: bookingsByDay.map((item) => ({
        date: item._id,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      bookingsByWeek: bookingsByWeek.map((item) => ({
        week: item._id,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      bookingsByMonth: bookingsByMonth.map((item) => ({
        month: item._id,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      newUsersByMonth: newUsersByMonth.map((item) => ({
        month: item._id,
        newUsers: item.newUsers,
        totalUsers: 0, // Would need additional aggregation for this
      })),
      newPropertiesByMonth: newPropertiesByMonth.map((item) => ({
        month: item._id,
        newProperties: item.newProperties,
        totalProperties: 0, // Would need additional aggregation for this
      })),
      reviewsByMonth: reviewsByMonth.map((item) => ({
        month: item._id,
        reviews: item.reviews,
        averageRating: item.averageRating,
      })),
    };
  }

  private async getPerformanceStatistics(dateFilter: any, propertyId?: string) {
    const propertyFilter = propertyId
      ? { property_id: new Types.ObjectId(propertyId) }
      : {};

    const [
      averageOccupancyRate,
      occupancyByProperty,
      averageAdvanceBookingDays,
      averageStayDuration,
      voucherUsageRate,
      averageVoucherDiscount,
      topVouchers,
      averageServicesPerBooking,
      topServices,
    ] = await Promise.all([
      // Average occupancy rate
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            status: { $in: ['confirmed', 'completed'] },
            ...dateFilter,
          },
        },
        { $group: { _id: null, totalNights: { $sum: '$nights' } } },
      ]),

      // Occupancy by property
      this.bookingModel.aggregate([
        {
          $match: {
            status: { $in: ['confirmed', 'completed'] },
            ...dateFilter,
          },
        },
        {
          $lookup: {
            from: 'listings',
            localField: 'listingId',
            foreignField: '_id',
            as: 'listing',
          },
        },
        { $unwind: '$listing' },
        {
          $lookup: {
            from: 'properties',
            localField: 'listing.propertyId',
            foreignField: '_id',
            as: 'property',
          },
        },
        { $unwind: '$property' },
        {
          $group: {
            _id: '$property._id',
            propertyName: { $first: '$property.name' },
            totalNights: { $sum: '$nights' },
          },
        },
        { $sort: { totalNights: -1 } },
        { $limit: 10 },
      ]),

      // Average advance booking days
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        { $group: { _id: null, average: { $avg: '$advance_booking_days' } } },
      ]),

      // Average stay duration
      this.bookingModel.aggregate([
        { $match: { ...propertyFilter, ...dateFilter } },
        { $group: { _id: null, average: { $avg: '$nights' } } },
      ]),

      // Voucher usage rate
      this.bookingModel.aggregate([
        {
          $match: { ...propertyFilter, payment_status: 'paid', ...dateFilter },
        },
        { $group: { _id: null, total: { $sum: 1 } } },
      ]),

      // Average voucher discount
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            payment_status: 'paid',
            'metadata.voucherCode': { $exists: true, $ne: null },
            ...dateFilter,
          },
        },
        {
          $group: { _id: null, average: { $avg: '$metadata.discountAmount' } },
        },
      ]),

      // Top vouchers
      this.voucherModel.aggregate([
        { $match: { isDeleted: false } },
        { $sort: { uses_count: -1 } },
        { $limit: 10 },
        {
          $project: {
            voucherId: '$_id',
            voucherCode: '$code',
            usageCount: '$uses_count',
            totalDiscount: '$discount_amount',
          },
        },
      ]),

      // Average services per booking
      this.bookingModel.aggregate([
        {
          $match: {
            ...propertyFilter,
            payment_status: 'paid',
            'metadata.services': { $exists: true, $ne: [] },
            ...dateFilter,
          },
        },
        {
          $group: { _id: null, average: { $avg: '$metadata.services.price' } },
        },
      ]),

      // Top services
      this.serviceModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $lookup: {
            from: 'bookings',
            localField: '_id',
            foreignField: 'metadata.services.serviceId',
            as: 'bookings',
          },
        },
        {
          $project: {
            serviceId: '$_id',
            serviceName: '$name',
            usageCount: { $size: '$bookings' },
            totalRevenue: {
              $sum: '$bookings.metadata.services.price',
            },
          },
        },
        { $sort: { usageCount: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      averageOccupancyRate: averageOccupancyRate[0]?.totalNights
        ? averageOccupancyRate[0]?.totalNights /
          (averageStayDuration[0]?.average || 1)
        : 0,
      occupancyByProperty: occupancyByProperty.map((item) => ({
        propertyId: item._id.toString(),
        propertyName: item.propertyName,
        occupancyRate:
          item.totalNights / (averageStayDuration[0]?.average || 1),
      })),
      averageAdvanceBookingDays: averageAdvanceBookingDays[0]?.average || 0,
      averageStayDuration: averageStayDuration[0]?.average || 0,
      voucherUsageRate: voucherUsageRate[0]?.total || 0,
      averageVoucherDiscount: averageVoucherDiscount[0]?.average || 0,
      topVouchers: topVouchers.map((item) => ({
        voucherId: item.voucherId.toString(),
        voucherCode: item.voucherCode,
        usageCount: item.usageCount,
        totalDiscount: item.totalDiscount,
      })),
      averageServicesPerBooking: averageServicesPerBooking[0]?.average || 0,
      topServices: topServices.map((item) => ({
        serviceId: item.serviceId.toString(),
        serviceName: item.serviceName,
        usageCount: item.usageCount || 0,
        totalRevenue: item.totalRevenue || 0,
      })),
    };
  }

  async getRealTimeStatistics() {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        onlineUsers,
        activeBookings,
        pendingBookings,
        recentMessages,
        recentReviews,
        recentVoucherUsage,
      ] = await Promise.all([
        // Online users (users active in last 5 minutes)
        this.userModel.countDocuments({
          last_seen: { $gte: new Date(now.getTime() - 5 * 60 * 1000) },
        }),

        // Active bookings (confirmed or completed)
        this.bookingModel.countDocuments({
          status: { $in: ['confirmed', 'completed'] },
        }),

        // Pending bookings
        this.bookingModel.countDocuments({
          status: 'pending',
        }),

        // Recent messages (last 24 hours)
        this.messageModel.countDocuments({
          created_at: { $gte: last24Hours },
        }),

        // Recent reviews (last 24 hours)
        this.reviewModel.countDocuments({
          created_at: { $gte: last24Hours },
        }),

        // Recent voucher usage (last 24 hours)
        this.bookingModel.countDocuments({
          'metadata.voucherCode': { $exists: true, $ne: null },
          created_at: { $gte: last24Hours },
        }),
      ]);

      return {
        onlineUsers,
        activeBookings,
        pendingBookings,
        recentMessages,
        recentReviews,
        recentVoucherUsage,
      };
    } catch (error) {
      this.logger.error('Error getting real-time statistics:', error);
      throw error;
    }
  }

  // Public method for overview statistics
  async getDashboardOverview(propertyId?: string) {
    try {
      const dateFilter = {};
      return await this.getOverviewStatistics(dateFilter, propertyId);
    } catch (error) {
      this.logger.error('Error getting dashboard overview:', error);
      throw error;
    }
  }
}
