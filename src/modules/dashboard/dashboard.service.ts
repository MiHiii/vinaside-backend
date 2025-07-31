import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';
import { Listing } from '../listing/schemas/listing.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Voucher } from '../vouchers/schemas/voucher.schema';
import { Service } from '../services/schemas/service.schema';
import { Message } from '../messages/schemas/message.schema';
import { Wishlist } from '../wishlist/schemas/wishlist.schema';
import {
  DashboardStatistics,
  DashboardOverviewStatistics,
  DashboardFinancialStatistics,
  DashboardCustomerStatistics,
  DashboardTimelineStatistics,
  DashboardPerformanceStatistics,
  DashboardRealTimeStatistics,
} from './dto/dashboard-statistics';
import { getDefaultDateRange } from '../../utils/date.util';

interface DateFilter {
  created_at: { $gte: Date; $lte: Date };
}

interface UserRoleCount {
  _id: string;
  count: number;
}

interface PropertyStatusCount {
  _id: string;
  count: number;
}

interface ListingStatusCount {
  _id: string;
  count: number;
}

interface BookingStatusCount {
  _id: string;
  count: number;
}

interface RatingDistribution {
  _id: number;
  count: number;
}

interface RevenueByMonth {
  _id: {
    year: number;
    month: number;
  };
  revenue: number;
  bookings: number;
  voucherDiscount: number;
  servicesRevenue: number;
}

interface TopPropertyRevenue {
  _id: string;
  propertyName: string;
  revenue: number;
  bookings: number;
}

interface CustomerStats {
  _id: string;
  customerName: string;
  totalBookings: number;
  totalSpent: number;
}

interface VoucherUsage {
  _id: string;
  voucherCode: string;
  usageCount: number;
  totalDiscount: number;
}

interface ServiceUsage {
  _id: string;
  serviceName: string;
  usageCount: number;
  totalRevenue: number;
}

interface BookingStats {
  totalNights: number;
  average: number;
}

interface PropertyBookingStats {
  _id: string;
  propertyName: string;
  totalNights: number;
  average: number;
}

interface VoucherStats {
  totalVouchers: number;
  activeVouchers: number;
  usedVouchers: number;
  totalVoucherDiscount: number;
}

interface ServiceStats {
  totalServices: number;
  activeServices: number;
}

interface MessageStats {
  totalMessages: number;
  total: number;
  totalReactions: number;
}

interface CustomerData {
  totalCustomers: number;
  newCustomers: number;
}

interface EngagementData {
  averageNightsPerBooking: number;
  averageGuestsPerBooking: number;
  customersUsingVouchers: number;
  customersUsingServices: number;
}

interface ReviewData {
  total: number;
  average: number;
  positiveReviews: number;
  negativeReviews: number;
}

interface BookingDayStats {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  bookings: number;
  revenue: number;
}

interface BookingWeekStats {
  _id: {
    year: number;
    week: number;
  };
  bookings: number;
  revenue: number;
}

interface BookingMonthStats {
  _id: {
    year: number;
    month: number;
  };
  bookings: number;
  revenue: number;
}

interface UserGrowthStats {
  _id: {
    year: number;
    month: number;
  };
  newUsers: number;
}

interface PropertyGrowthStats {
  _id: {
    year: number;
    month: number;
  };
  newProperties: number;
}

interface ReviewTrendStats {
  _id: {
    year: number;
    month: number;
  };
  reviews: number;
  averageRating: number;
}

interface BookingPatternData {
  averageAdvanceBookingDays: number;
  averageStayDuration: number;
}

interface VoucherPerformanceData {
  voucherUsageRate: number;
  averageVoucherDiscount: number;
}

interface ServicePerformanceData {
  averageServicesPerBooking: number;
}

interface AggregationResult {
  _id: string | null;
  total?: number;
  average?: number;
  returningCustomers?: number;
}

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
    @InjectModel(Wishlist.name) private wishlistModel: Model<Wishlist>,
  ) {}

  async getDashboardStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
  ): Promise<DashboardStatistics> {
    try {
      const { startDate: start, endDate: end } = getDefaultDateRange();
      const dateFilter: DateFilter = {
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
      const timeline = await this.getTimelineStatistics(dateFilter, propertyId);

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

  private async getOverviewStatistics(
    dateFilter: DateFilter,
    propertyId?: string,
  ): Promise<DashboardOverviewStatistics> {
    const propertyFilter = propertyId
      ? { propertyId: new Types.ObjectId(propertyId) }
      : {};

    // User statistics
    const userStats = (await this.userModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ])) as UserRoleCount[];

    const usersByRole = {
      guest: 0,
      staff: 0,
      admin: 0,
    };

    userStats.forEach((item: UserRoleCount) => {
      const role = item._id;
      if (role && role in usersByRole) {
        usersByRole[role as keyof typeof usersByRole] = item.count;
      }
    });

    const totalUsers = userStats.reduce(
      (sum: number, item: UserRoleCount) => sum + item.count,
      0,
    );

    // Property statistics
    const propertyStats = (await this.propertyModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ])) as PropertyStatusCount[];

    const propertiesByStatus = {
      active: 0,
      inactive: 0,
      pending: 0,
    };

    propertyStats.forEach((item: PropertyStatusCount) => {
      const status = item._id;
      if (status && status in propertiesByStatus) {
        propertiesByStatus[status as keyof typeof propertiesByStatus] =
          item.count;
      }
    });

    const totalProperties = propertyStats.reduce(
      (sum: number, item: PropertyStatusCount) => sum + item.count,
      0,
    );

    // Listing statistics
    const listingStats = (await this.listingModel.aggregate([
      { $match: propertyFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ])) as ListingStatusCount[];

    const listingsByStatus = {
      active: 0,
      inactive: 0,
      draft: 0,
    };

    listingStats.forEach((item: ListingStatusCount) => {
      const status = item._id;
      if (status && status in listingsByStatus) {
        listingsByStatus[status as keyof typeof listingsByStatus] = item.count;
      }
    });

    const totalListings = listingStats.reduce(
      (sum: number, item: ListingStatusCount) => sum + item.count,
      0,
    );

    // Booking statistics
    const bookingStats = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ])) as BookingStatusCount[];

    const bookingsByStatus = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      rejected: 0,
    };

    bookingStats.forEach((item: BookingStatusCount) => {
      const status = item._id;
      if (status && status in bookingsByStatus) {
        bookingsByStatus[status as keyof typeof bookingsByStatus] = item.count;
      }
    });

    const totalBookings = bookingStats.reduce(
      (sum: number, item: BookingStatusCount) => sum + item.count,
      0,
    );

    // Review statistics
    const reviewStats = (await this.reviewModel.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ])) as RatingDistribution[];

    const ratingDistribution: { [rating: number]: number } = {};
    reviewStats.forEach((item: RatingDistribution) => {
      ratingDistribution[item._id] = item.count;
    });

    const totalReviews = reviewStats.reduce(
      (sum: number, item: RatingDistribution) => sum + item.count,
      0,
    );

    // Voucher statistics
    const voucherStats = (await this.voucherModel.aggregate([
      {
        $group: {
          _id: null,
          totalVouchers: { $sum: 1 },
          activeVouchers: {
            $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] },
          },
          usedVouchers: {
            $sum: { $cond: [{ $gt: ['$uses_count', 0] }, 1, 0] },
          },
          totalVoucherDiscount: {
            $sum: { $multiply: ['$discount_percent', 0.01] },
          },
        },
      },
    ])) as VoucherStats[];

    const voucherData = voucherStats[0] || {
      totalVouchers: 0,
      activeVouchers: 0,
      usedVouchers: 0,
      totalVoucherDiscount: 0,
    };

    // Service statistics
    const serviceStats = (await this.serviceModel.aggregate([
      {
        $group: {
          _id: null,
          totalServices: { $sum: 1 },
          activeServices: {
            $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] },
          },
        },
      },
    ])) as ServiceStats[];

    const serviceData = serviceStats[0] || {
      totalServices: 0,
      activeServices: 0,
    };

    // Message statistics
    const messageStats = (await this.messageModel.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          total: { $sum: 1 },
          totalReactions: { $sum: 1 },
        },
      },
    ])) as MessageStats[];

    const messageData = messageStats[0] || {
      totalMessages: 0,
      total: 0,
      totalReactions: 0,
    };

    // Wishlist statistics
    const wishlistStats = (await this.wishlistModel.aggregate([
      {
        $group: {
          _id: null,
          totalWishlists: { $sum: 1 },
          totalWishlistItems: { $sum: 1 },
        },
      },
    ])) as any[];

    const wishlistData = wishlistStats[0] || {
      totalWishlists: 0,
      totalWishlistItems: 0,
    };

    // Calculate averages and totals
    const totalRevenue = await this.calculateTotalRevenue({});
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const averagePricePerNight = await this.calculateAveragePricePerNight({});
    const activeProperties = propertiesByStatus.active;
    const verifiedProperties = await this.countVerifiedProperties({});
    const activeListings = listingsByStatus.active;
    const averageRating = await this.calculateAverageRating({});
    const totalServicesRevenue = await this.calculateTotalServicesRevenue({});
    const newUsersLast30Days = await this.countNewUsersLast30Days();

    return {
      totalUsers,
      usersByRole,
      newUsersLast30Days,
      totalProperties,
      activeProperties,
      verifiedProperties,
      propertiesByStatus,
      totalListings,
      activeListings,
      averagePricePerNight,
      listingsByStatus,
      totalBookings,
      totalRevenue,
      averageBookingValue,
      bookingsByStatus,
      totalReviews,
      averageRating,
      ratingDistribution,
      totalVouchers: voucherData.totalVouchers,
      activeVouchers: voucherData.activeVouchers,
      usedVouchers: voucherData.usedVouchers,
      totalVoucherDiscount: voucherData.totalVoucherDiscount,
      totalServices: serviceData.totalServices,
      activeServices: serviceData.activeServices,
      totalServicesRevenue,
      totalMessages: messageData.totalMessages,
      totalConversations: messageData.total,
      totalReactions: messageData.totalReactions,
      totalWishlists: wishlistData.totalWishlists,
      totalWishlistItems: wishlistData.totalWishlistItems,
    };
  }

  private async getFinancialStatistics(
    dateFilter: DateFilter,
    propertyId?: string,
  ): Promise<DashboardFinancialStatistics> {
    const propertyFilter = propertyId
      ? { propertyId: new Types.ObjectId(propertyId) }
      : {};

    // Revenue by month
    const revenueByMonth = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          revenue: { $sum: '$final_amount' },
          bookings: { $sum: 1 },
          voucherDiscount: { $sum: '$voucher_discount_amount' },
          servicesRevenue: { $sum: '$services_total_amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])) as RevenueByMonth[];

    const formattedRevenueByMonth: Array<{
      month: string;
      revenue: number;
      bookings: number;
      voucherDiscount: number;
      servicesRevenue: number;
    }> = revenueByMonth.map((item: RevenueByMonth) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.revenue,
      bookings: item.bookings,
      voucherDiscount: item.voucherDiscount,
      servicesRevenue: item.servicesRevenue,
    }));

    // Top performing properties
    const topPropertiesByRevenue = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'propertyInfo',
        },
      },
      { $unwind: '$propertyInfo' },
      {
        $group: {
          _id: '$propertyId',
          propertyName: { $first: '$propertyInfo.name' },
          revenue: { $sum: '$final_amount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ])) as TopPropertyRevenue[];

    const formattedTopProperties: Array<{
      propertyId: string;
      propertyName: string;
      revenue: number;
      bookings: number;
    }> = topPropertiesByRevenue.map((item: TopPropertyRevenue) => ({
      propertyId: item._id.toString(),
      propertyName: item.propertyName,
      revenue: item.revenue,
      bookings: item.bookings,
    }));

    // Calculate totals
    const totalRevenue = formattedRevenueByMonth.reduce(
      (sum, item) => sum + item.revenue,
      0,
    );
    const totalVoucherDiscount = formattedRevenueByMonth.reduce(
      (sum, item) => sum + item.voucherDiscount,
      0,
    );
    const totalServicesRevenue = formattedRevenueByMonth.reduce(
      (sum, item) => sum + item.servicesRevenue,
      0,
    );

    const totalRevenueBeforeVoucher = totalRevenue + totalVoucherDiscount;
    const voucherDiscountPercentage =
      totalRevenueBeforeVoucher > 0
        ? (totalVoucherDiscount / totalRevenueBeforeVoucher) * 100
        : 0;
    const servicesRevenuePercentage =
      totalRevenue > 0 ? (totalServicesRevenue / totalRevenue) * 100 : 0;

    // Calculate other financial metrics
    const totalServiceFees =
      await this.calculateTotalServiceFees(propertyFilter);
    const totalTaxAmount = await this.calculateTotalTaxAmount(propertyFilter);
    const totalRefunds = await this.calculateTotalRefunds(propertyFilter);
    const netRevenue = totalRevenue - totalRefunds;

    return {
      totalRevenue,
      totalServiceFees,
      totalTaxAmount,
      totalRefunds,
      netRevenue,
      totalVoucherDiscount,
      totalRevenueBeforeVoucher,
      voucherDiscountPercentage,
      totalServicesRevenue,
      servicesRevenuePercentage,
      revenueByMonth: formattedRevenueByMonth,
      topPropertiesByRevenue: formattedTopProperties,
    };
  }

  private async getCustomerStatistics(
    dateFilter: DateFilter,
    propertyId?: string,
  ): Promise<DashboardCustomerStatistics> {
    const propertyFilter = propertyId
      ? { propertyId: new Types.ObjectId(propertyId) }
      : {};

    // Customer counts
    const customerStats = (await this.userModel.aggregate([
      { $match: { ...dateFilter, role: 'guest' } },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          newCustomers: { $sum: 1 },
        },
      },
    ])) as CustomerData[];

    const customerData = customerStats[0] || {
      totalCustomers: 0,
      newCustomers: 0,
    };

    // Top customers
    const topCustomers = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $lookup: {
          from: 'users',
          localField: 'guestId',
          foreignField: '_id',
          as: 'customerInfo',
        },
      },
      { $unwind: '$customerInfo' },
      {
        $group: {
          _id: '$guestId',
          customerName: { $first: '$customerInfo.name' },
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$final_amount' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
    ])) as CustomerStats[];

    const formattedTopCustomers: Array<{
      customerId: string;
      customerName: string;
      totalBookings: number;
      totalSpent: number;
    }> = topCustomers.map((item: CustomerStats) => ({
      customerId: item._id.toString(),
      customerName: item.customerName,
      totalBookings: item.totalBookings,
      totalSpent: item.totalSpent,
    }));

    // Customer engagement metrics
    const engagementStats = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: null,
          averageNightsPerBooking: { $avg: '$nights' },
          averageGuestsPerBooking: { $avg: '$guests' },
          customersUsingVouchers: {
            $sum: { $cond: [{ $gt: ['$voucher_discount_amount', 0] }, 1, 0] },
          },
          customersUsingServices: {
            $sum: { $cond: [{ $gt: ['$services_total_amount', 0] }, 1, 0] },
          },
        },
      },
    ])) as EngagementData[];

    const engagementData = engagementStats[0] || {
      averageNightsPerBooking: 0,
      averageGuestsPerBooking: 0,
      customersUsingVouchers: 0,
      customersUsingServices: 0,
    };

    // Customer satisfaction
    const reviewStats = (await this.reviewModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average: { $avg: '$rating' },
          positiveReviews: {
            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] },
          },
          negativeReviews: {
            $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] },
          },
        },
      },
    ])) as ReviewData[];

    const reviewData = reviewStats[0] || {
      total: 0,
      average: 0,
      positiveReviews: 0,
      negativeReviews: 0,
    };

    const returningCustomers = await this.calculateReturningCustomers(
      dateFilter,
      propertyFilter,
    );

    return {
      totalCustomers: customerData.totalCustomers,
      newCustomers: customerData.newCustomers,
      returningCustomers,
      averageNightsPerBooking: engagementData.averageNightsPerBooking,
      averageGuestsPerBooking: engagementData.averageGuestsPerBooking,
      customersUsingVouchers: engagementData.customersUsingVouchers,
      customersUsingServices: engagementData.customersUsingServices,
      topCustomers: formattedTopCustomers,
      averageRating: reviewData.average,
      totalReviews: reviewData.total,
      positiveReviews: reviewData.positiveReviews,
      negativeReviews: reviewData.negativeReviews,
    };
  }

  private async getTimelineStatistics(
    dateFilter: DateFilter,
    propertyId?: string,
  ): Promise<DashboardTimelineStatistics> {
    const propertyFilter = propertyId
      ? { propertyId: new Types.ObjectId(propertyId) }
      : {};

    // Bookings by day
    const bookingsByDay = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ])) as BookingDayStats[];

    const formattedBookingsByDay: Array<{
      date: string;
      bookings: number;
      revenue: number;
    }> = bookingsByDay.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(
        item._id.day,
      ).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // Bookings by week
    const bookingsByWeek = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            week: { $week: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ])) as BookingWeekStats[];

    const formattedBookingsByWeek: Array<{
      week: string;
      bookings: number;
      revenue: number;
    }> = bookingsByWeek.map((item) => ({
      week: `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // Bookings by month
    const bookingsByMonth = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])) as BookingMonthStats[];

    const formattedBookingsByMonth: Array<{
      month: string;
      bookings: number;
      revenue: number;
    }> = bookingsByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // User growth
    const newUsersByMonth = (await this.userModel.aggregate([
      { $match: { ...dateFilter, role: 'guest' } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])) as UserGrowthStats[];

    const formattedNewUsersByMonth: Array<{
      month: string;
      newUsers: number;
      totalUsers: number;
    }> = newUsersByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      newUsers: item.newUsers,
      totalUsers: 0, // Will be calculated
    }));

    // Property growth
    const newPropertiesByMonth = (await this.propertyModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          newProperties: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])) as PropertyGrowthStats[];

    const formattedNewPropertiesByMonth: Array<{
      month: string;
      newProperties: number;
      totalProperties: number;
    }> = newPropertiesByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      newProperties: item.newProperties,
      totalProperties: 0, // Will be calculated
    }));

    // Review trends
    const reviewsByMonth = (await this.reviewModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          reviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])) as ReviewTrendStats[];

    const formattedReviewsByMonth: Array<{
      month: string;
      reviews: number;
      averageRating: number;
    }> = reviewsByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      reviews: item.reviews,
      averageRating: item.averageRating,
    }));

    return {
      bookingsByDay: formattedBookingsByDay,
      bookingsByWeek: formattedBookingsByWeek,
      bookingsByMonth: formattedBookingsByMonth,
      newUsersByMonth: formattedNewUsersByMonth,
      newPropertiesByMonth: formattedNewPropertiesByMonth,
      reviewsByMonth: formattedReviewsByMonth,
    };
  }

  private async getPerformanceStatistics(
    dateFilter: DateFilter,
    propertyId?: string,
  ): Promise<DashboardPerformanceStatistics> {
    const propertyFilter = propertyId
      ? { propertyId: new Types.ObjectId(propertyId) }
      : {};

    // Occupancy rates
    const occupancyStats = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: '$property',
          totalNights: { $sum: '$nights' },
          average: { $avg: '$nights' },
        },
      },
    ])) as BookingStats[];

    const averageOccupancyRate =
      occupancyStats.length > 0
        ? occupancyStats.reduce(
            (sum, item: BookingStats) => sum + item.average,
            0,
          ) / occupancyStats.length
        : 0;

    // Occupancy by property
    const occupancyByProperty = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'propertyInfo',
        },
      },
      { $unwind: '$propertyInfo' },
      {
        $group: {
          _id: '$propertyId',
          propertyName: { $first: '$propertyInfo.name' },
          totalNights: { $sum: '$nights' },
          average: { $avg: '$nights' },
        },
      },
    ])) as PropertyBookingStats[];

    const formattedOccupancyByProperty: Array<{
      propertyId: string;
      propertyName: string;
      occupancyRate: number;
    }> = occupancyByProperty.map((item: PropertyBookingStats) => ({
      propertyId: item._id.toString(),
      propertyName: item.propertyName,
      occupancyRate: item.average,
    }));

    // Booking patterns
    const bookingPatterns = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: null,
          averageAdvanceBookingDays: {
            $avg: {
              $divide: [
                { $subtract: ['$checkInDate', '$created_at'] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
          averageStayDuration: { $avg: '$nights' },
        },
      },
    ])) as BookingPatternData[];

    const patternData = bookingPatterns[0] || {
      averageAdvanceBookingDays: 0,
      averageStayDuration: 0,
    };

    // Voucher performance
    const voucherPerformance = (await this.voucherModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          voucherUsageRate: {
            $avg: { $divide: ['$uses_count', '$max_uses'] },
          },
          averageVoucherDiscount: { $avg: '$discount_percent' },
        },
      },
    ])) as VoucherPerformanceData[];

    const voucherData = voucherPerformance[0] || {
      voucherUsageRate: 0,
      averageVoucherDiscount: 0,
    };

    // Top vouchers
    const topVouchers = (await this.voucherModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$_id',
          voucherCode: { $first: '$code' },
          usageCount: { $first: '$uses_count' },
          totalDiscount: { $first: '$discount_percent' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
    ])) as VoucherUsage[];

    const formattedTopVouchers: Array<{
      voucherId: string;
      voucherCode: string;
      usageCount: number;
      totalDiscount: number;
    }> = topVouchers.map((item: VoucherUsage) => ({
      voucherId: item._id.toString(),
      voucherCode: item.voucherCode,
      usageCount: item.usageCount,
      totalDiscount: item.totalDiscount,
    }));

    // Service performance - calculate from booking data instead
    const servicePerformance = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      {
        $group: {
          _id: null,
          averageServicesPerBooking: { $avg: { $size: '$selected_services' } },
        },
      },
    ])) as ServicePerformanceData[];

    const serviceData = servicePerformance[0] || {
      averageServicesPerBooking: 0,
    };

    // Top services - calculate from booking data instead
    const topServices = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
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
      { $limit: 10 },
    ])) as ServiceUsage[];

    const formattedTopServices: Array<{
      serviceId: string;
      serviceName: string;
      usageCount: number;
      totalRevenue: number;
    }> = topServices.map((item: ServiceUsage) => ({
      serviceId: item._id.toString(),
      serviceName: item.serviceName,
      usageCount: item.usageCount,
      totalRevenue: item.totalRevenue,
    }));

    return {
      averageOccupancyRate,
      occupancyByProperty: formattedOccupancyByProperty,
      averageAdvanceBookingDays: patternData.averageAdvanceBookingDays,
      averageStayDuration: patternData.averageStayDuration,
      voucherUsageRate: voucherData.voucherUsageRate,
      averageVoucherDiscount: voucherData.averageVoucherDiscount,
      topVouchers: formattedTopVouchers,
      averageServicesPerBooking: serviceData.averageServicesPerBooking,
      topServices: formattedTopServices,
    };
  }

  async getRealTimeStatistics(): Promise<DashboardRealTimeStatistics> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const onlineUsers = await this.userModel.countDocuments({
      updated_at: { $gte: last24Hours },
    });

    const activeBookings = await this.bookingModel.countDocuments({
      status: { $in: ['confirmed', 'pending'] },
    });

    const pendingBookings = await this.bookingModel.countDocuments({
      status: 'pending',
    });

    const recentMessages = await this.messageModel.countDocuments({
      created_at: { $gte: last24Hours },
    });

    const recentReviews = await this.reviewModel.countDocuments({
      created_at: { $gte: last24Hours },
    });

    const recentVoucherUsage = await this.voucherModel.countDocuments({
      updated_at: { $gte: last24Hours },
    });

    return {
      onlineUsers,
      activeBookings,
      pendingBookings,
      recentMessages,
      recentReviews,
      recentVoucherUsage,
    };
  }

  // Helper methods
  private async calculateTotalRevenue(
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: propertyFilter },
      { $group: { _id: null, total: { $sum: '$final_amount' } } },
    ])) as AggregationResult[];
    return result[0]?.total || 0;
  }

  private async calculateAveragePricePerNight(
    propertyFilter: FilterQuery<Listing>,
  ): Promise<number> {
    const result = (await this.listingModel.aggregate([
      { $match: { ...propertyFilter, status: 'active' } },
      { $group: { _id: null, average: { $avg: '$price_per_night' } } },
    ])) as AggregationResult[];
    return result[0]?.average || 0;
  }

  private async countVerifiedProperties(
    propertyFilter: FilterQuery<Property>,
  ): Promise<number> {
    return this.propertyModel.countDocuments({
      ...propertyFilter,
      isVerified: true,
    });
  }

  private async calculateAverageRating(
    propertyFilter: FilterQuery<Review>,
  ): Promise<number> {
    const result = (await this.reviewModel.aggregate([
      { $match: propertyFilter },
      { $group: { _id: null, average: { $avg: '$rating' } } },
    ])) as AggregationResult[];
    return result[0]?.average || 0;
  }

  private async calculateTotalServicesRevenue(
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: propertyFilter },
      { $group: { _id: null, total: { $sum: '$services_total_amount' } } },
    ])) as AggregationResult[];
    return result[0]?.total || 0;
  }

  private async countNewUsersLast30Days(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      role: 'guest',
    });
  }

  private async calculateReturningCustomers(
    dateFilter: DateFilter,
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyFilter } },
      { $group: { _id: '$customer', bookingCount: { $sum: 1 } } },
      { $match: { bookingCount: { $gt: 1 } } },
      { $count: 'returningCustomers' },
    ])) as AggregationResult[];
    return result[0]?.returningCustomers || 0;
  }

  private async calculateTotalServiceFees(
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: propertyFilter },
      { $group: { _id: null, total: { $sum: '$service_fee' } } },
    ])) as AggregationResult[];
    return result[0]?.total || 0;
  }

  private async calculateTotalTaxAmount(
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: propertyFilter },
      { $group: { _id: null, total: { $sum: '$tax_amount' } } },
    ])) as AggregationResult[];
    return result[0]?.total || 0;
  }

  private async calculateTotalRefunds(
    propertyFilter: FilterQuery<Booking>,
  ): Promise<number> {
    const result = (await this.bookingModel.aggregate([
      { $match: { ...propertyFilter, status: 'cancelled' } },
      { $group: { _id: null, total: { $sum: '$refund_amount' } } },
    ])) as AggregationResult[];
    return result[0]?.total || 0;
  }

  async getDashboardOverview(propertyId?: string) {
    const { startDate, endDate } = getDefaultDateRange();
    const dateFilter: DateFilter = {
      created_at: { $gte: startDate, $lte: endDate },
    };

    return this.getOverviewStatistics(dateFilter, propertyId);
  }
}
