import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';
import { Listing } from '../listing/schemas/listing.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Voucher } from '../vouchers/schemas/voucher.schema';
import { Service } from '../services/schemas/service.schema';
import { Message } from '../messages/schemas/message.schema';
import { Wishlist } from '../wishlist/schemas/wishlist.schema';
import { PropertyStaffAssignment } from '../property-staff-assignment/schemas/property-staff-assignment.schema';
import {
  DashboardStatistics,
  DashboardOverviewStatistics,
  DashboardFinancialStatistics,
  DashboardCustomerStatistics,
  DashboardTimelineStatistics,
  DashboardPerformanceStatistics,
  DashboardRealTimeStatistics,
  RevenueChartResponse,
} from './dto/dashboard-statistics';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { RevenueChartDto, DateRangeType } from './dto/query-dashboard.dto';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

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

// Aggregation result interfaces for type safety
interface VoucherAggregation {
  totalVouchers: number;
  activeVouchers: number;
  usedVouchers: number;
  totalVoucherDiscount: number;
}

interface ServiceAggregation {
  totalServices: number;
  activeServices: number;
}

interface MessageAggregation {
  totalMessages: number;
  total: number;
  totalReactions: number;
}

interface WishlistAggregation {
  totalWishlists: number;
  totalWishlistItems: number;
}

interface CustomerAggregation {
  totalCustomers: number;
  newCustomers: number;
}

interface EngagementAggregation {
  averageNightsPerBooking: number;
  averageGuestsPerBooking: number;
  customersUsingVouchers: number;
  customersUsingServices: number;
}

interface ReviewAggregation {
  total: number;
  average: number;
  positiveReviews: number;
  negativeReviews: number;
}

interface BookingDayAggregation {
  _id: {
    year: number;
    month: number;
    day: number;
  };
  bookings: number;
  revenue: number;
}

interface BookingWeekAggregation {
  _id: {
    year: number;
    week: number;
  };
  bookings: number;
  revenue: number;
}

interface BookingMonthAggregation {
  _id: {
    year: number;
    month: number;
  };
  bookings: number;
  revenue: number;
}

interface UserGrowthAggregation {
  _id: {
    year: number;
    month: number;
  };
  newUsers: number;
}

interface PropertyGrowthAggregation {
  _id: {
    year: number;
    month: number;
  };
  newProperties: number;
}

interface ReviewTrendAggregation {
  _id: {
    year: number;
    month: number;
  };
  reviews: number;
  averageRating: number;
}

interface BookingPatternAggregation {
  averageAdvanceBookingDays: number;
  averageStayDuration: number;
}

interface VoucherPerformanceAggregation {
  voucherUsageRate: number;
  averageVoucherDiscount: number;
}

interface ServicePerformanceAggregation {
  averageServicesPerBooking: number;
}

interface TotalAggregation {
  total: number;
}

interface AverageAggregation {
  average: number;
}

interface ReturningCustomersAggregation {
  returningCustomers: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private parsePropertyIds(propertyId?: string): Types.ObjectId[] | undefined {
    if (!propertyId) return undefined;

    try {
      return propertyId.split(',').map((id) => new Types.ObjectId(id.trim()));
    } catch {
      this.logger.error(`Invalid property ID format: ${propertyId}`);
      throw new Error('Invalid property ID format');
    }
  }

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
    @InjectModel(PropertyStaffAssignment.name)
    private propertyStaffAssignmentModel: Model<PropertyStaffAssignment>,
  ) {}

  /**
   * Get properties that a staff user is assigned to manage
   */
  private async getStaffManagedProperties(staffId: string): Promise<string[]> {
    const assignments = await this.propertyStaffAssignmentModel
      .find({
        staffId: staffId, // Convert to string vì DB lưu dưới dạng string
        status: 'active',
      })
      .select('propertyId')
      .lean();

    return assignments.map((assignment) => assignment.propertyId.toString());
  }

  /**
   * Get property filter based on user role and permissions
   */
  async getPropertyFilter(
    user: JwtPayload,
    requestedPropertyIds?: string,
  ): Promise<Types.ObjectId[] | undefined> {
    // If user is admin, they can access all properties
    if (user.role === 'admin') {
      return this.parsePropertyIds(requestedPropertyIds);
    }

    // If user is staff, they can only access their assigned properties
    if (user.role === 'staff') {
      const staffManagedProperties = await this.getStaffManagedProperties(
        user._id,
      );

      if (staffManagedProperties.length === 0) {
        throw new Error('Staff user is not assigned to any properties');
      }

      // If specific property IDs are requested, filter to only those the staff manages
      if (requestedPropertyIds) {
        const requestedIds = this.parsePropertyIds(requestedPropertyIds);
        const allowedIds = requestedIds?.filter((id) =>
          staffManagedProperties.some(
            (managedId) => managedId === id.toString(),
          ),
        );

        if (!allowedIds || allowedIds.length === 0) {
          throw new Error(
            'Staff user does not have access to the requested properties',
          );
        }

        return allowedIds;
      }

      // If no specific properties requested, return all managed properties as ObjectIds
      return staffManagedProperties.map((id) => new Types.ObjectId(id));
    }

    // For other roles, return undefined (no access)
    return undefined;
  }

  /**
   * Create property match filter for MongoDB queries
   */
  private createPropertyMatch(propertyFilter: Types.ObjectId[] | undefined): {
    propertyId?: { $in: Types.ObjectId[] };
  } {
    return propertyFilter && propertyFilter.length > 0
      ? { propertyId: { $in: propertyFilter } }
      : {};
  }

  /**
   * Check if we should apply property filtering
   * For admin users, if no specific properties are requested, we don't filter
   * For staff users, we always filter by their assigned properties
   */
  private shouldApplyPropertyFilter(
    user: JwtPayload | undefined,
    propertyFilter: Types.ObjectId[] | undefined,
  ): boolean {
    // If user is admin and no specific properties are requested, don't filter
    if (user?.role === 'admin' && !propertyFilter) {
      return false;
    }

    // For staff users or when specific properties are requested, always filter
    return true;
  }

  async getDashboardStatistics(
    queryDto: QueryDashboardDto,
    user?: JwtPayload,
  ): Promise<DashboardStatistics> {
    // Get property filter based on user role
    const propertyFilter = user
      ? await this.getPropertyFilter(user, queryDto.propertyId)
      : this.parsePropertyIds(queryDto.propertyId);

    try {
      const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);
      const dateFilter: DateFilter = {
        created_at: { $gte: startDate, $lte: endDate },
      };

      // 1. Overview Statistics
      const overview = await this.getOverviewStatistics(
        dateFilter,
        propertyFilter,
        user,
      );

      // 2. Financial Statistics
      const financial = await this.getFinancialStatistics(
        dateFilter,
        propertyFilter,
        user,
      );

      // 3. Customer Statistics
      const customers = await this.getCustomerStatistics(
        dateFilter,
        propertyFilter,
        user,
      );

      // 4. Timeline Statistics
      const timeline = await this.getTimelineStatistics(
        dateFilter,
        propertyFilter,
      );

      // 5. Performance Statistics
      const performance = await this.getPerformanceStatistics(
        dateFilter,
        propertyFilter,
      );

      // 6. Real-time Statistics
      const realTime = await this.getRealTimeStatistics(queryDto, user);

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
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<DashboardOverviewStatistics> {
    const propertyMatch = this.createPropertyMatch(propertyFilter);

    // User statistics - only count users related to the properties (guests who booked)
    const userStats: UserRoleCount[] = await this.userModel.aggregate([
      ...(propertyFilter && propertyFilter.length > 0
        ? [
            {
              $lookup: {
                from: 'bookings',
                localField: '_id',
                foreignField: 'guestId',
                as: 'bookings',
              },
            },
            {
              $match: {
                'bookings.propertyId': { $in: propertyFilter },
              },
            },
          ]
        : []),
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const usersByRole: { guest: number; staff: number; admin: number } = {
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

    // Property statistics - only count properties that are assigned
    const propertyStats: PropertyStatusCount[] =
      await this.propertyModel.aggregate([
        ...(propertyFilter && propertyFilter.length > 0
          ? [{ $match: { _id: { $in: propertyFilter } } }]
          : []),
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

    const propertiesByStatus: {
      active: number;
      inactive: number;
      pending: number;
    } = {
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
    const listingStats: ListingStatusCount[] =
      await this.listingModel.aggregate([
        { $match: propertyMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

    const listingsByStatus: {
      active: number;
      inactive: number;
      draft: number;
    } = {
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
    const bookingStats: BookingStatusCount[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

    const bookingsByStatus: {
      pending: number;
      confirmed: number;
      cancelled: number;
      completed: number;
      rejected: number;
    } = {
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

    // Review statistics - only count reviews for assigned properties
    const reviewStats: RatingDistribution[] = await this.reviewModel.aggregate([
      ...(propertyFilter && propertyFilter.length > 0
        ? [{ $match: { propertyId: { $in: propertyFilter } } }]
        : []),
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingDistribution: { [rating: number]: number } = {};
    reviewStats.forEach((item: RatingDistribution) => {
      ratingDistribution[item._id] = item.count;
    });

    const totalReviews = reviewStats.reduce(
      (sum: number, item: RatingDistribution) => sum + item.count,
      0,
    );

    // Voucher statistics - only count vouchers for assigned properties
    const voucherStats: VoucherAggregation[] =
      await this.voucherModel.aggregate([
        ...(propertyFilter && propertyFilter.length > 0
          ? [{ $match: { propertyId: { $in: propertyFilter } } }]
          : []),
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
              $sum: '$discount_percent', // Just sum the discount percentages for display
            },
          },
        },
      ]);

    const voucherData: VoucherAggregation = voucherStats[0] || {
      totalVouchers: 0,
      activeVouchers: 0,
      usedVouchers: 0,
      totalVoucherDiscount: 0,
    };

    // Service statistics - only count services for assigned properties
    const serviceStats: ServiceAggregation[] =
      await this.serviceModel.aggregate([
        ...(propertyFilter && propertyFilter.length > 0
          ? [{ $match: { propertyId: { $in: propertyFilter } } }]
          : []),
        {
          $group: {
            _id: null,
            totalServices: { $sum: 1 },
            activeServices: {
              $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] },
            },
          },
        },
      ]);

    const serviceData: ServiceAggregation = serviceStats[0] || {
      totalServices: 0,
      activeServices: 0,
    };

    // Message statistics - only count messages for assigned properties
    const messageStats: MessageAggregation[] =
      await this.messageModel.aggregate([
        ...(propertyFilter && propertyFilter.length > 0
          ? [{ $match: { propertyId: { $in: propertyFilter } } }]
          : []),
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            total: { $sum: 1 },
            totalReactions: { $sum: 1 },
          },
        },
      ]);

    const messageData: MessageAggregation = messageStats[0] || {
      totalMessages: 0,
      total: 0,
      totalReactions: 0,
    };

    // Wishlist statistics - only count wishlists for assigned properties
    const wishlistStats: WishlistAggregation[] =
      await this.wishlistModel.aggregate([
        ...(propertyFilter && propertyFilter.length > 0
          ? [{ $match: { propertyId: { $in: propertyFilter } } }]
          : []),
        {
          $group: {
            _id: null,
            totalWishlists: { $sum: 1 },
            totalWishlistItems: { $sum: 1 },
          },
        },
      ]);

    const wishlistData: WishlistAggregation = wishlistStats[0] || {
      totalWishlists: 0,
      totalWishlistItems: 0,
    };

    // Calculate averages and totals
    const totalRevenue = await this.calculateTotalRevenue(propertyFilter, user);
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const averagePricePerNight = await this.calculateAveragePricePerNight(
      propertyFilter,
      user,
    );
    const activeProperties = propertiesByStatus.active;
    const verifiedProperties = await this.countVerifiedProperties(
      propertyFilter,
      user,
    );
    const activeListings = listingsByStatus.active;
    const averageRating = await this.calculateAverageRating(
      propertyFilter,
      user,
    );
    const totalServicesRevenue = await this.calculateTotalServicesRevenue(
      propertyFilter,
      user,
    );
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
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<DashboardFinancialStatistics> {
    const propertyMatch = this.createPropertyMatch(propertyFilter);

    // Revenue by month
    const revenueByMonth: RevenueByMonth[] = await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyMatch } },
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
    ]);

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
    const topPropertiesByRevenue: TopPropertyRevenue[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

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
    const totalServiceFees = await this.calculateTotalServiceFees(
      propertyFilter,
      user,
    );
    const totalTaxAmount = await this.calculateTotalTaxAmount(
      propertyFilter,
      user,
    );
    const totalRefunds = await this.calculateTotalRefunds(propertyFilter, user);
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
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<DashboardCustomerStatistics> {
    const propertyMatch = this.createPropertyMatch(propertyFilter);

    // Customer counts
    const customerStats: CustomerAggregation[] = await this.userModel.aggregate(
      [
        { $match: { ...dateFilter, role: 'guest' } },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            newCustomers: { $sum: 1 },
          },
        },
      ],
    );

    const customerData: CustomerAggregation = customerStats[0] || {
      totalCustomers: 0,
      newCustomers: 0,
    };

    // Top customers
    const topCustomers: CustomerStats[] = await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyMatch } },
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
    ]);

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
    const engagementStats: EngagementAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const engagementData: EngagementAggregation = engagementStats[0] || {
      averageNightsPerBooking: 0,
      averageGuestsPerBooking: 0,
      customersUsingVouchers: 0,
      customersUsingServices: 0,
    };

    // Customer satisfaction
    const reviewStats: ReviewAggregation[] = await this.reviewModel.aggregate([
      { $match: { ...dateFilter, ...propertyMatch } },
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
    ]);

    const reviewData: ReviewAggregation = reviewStats[0] || {
      total: 0,
      average: 0,
      positiveReviews: 0,
      negativeReviews: 0,
    };

    const returningCustomers = await this.calculateReturningCustomers(
      dateFilter,
      propertyFilter,
      user,
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
    propertyFilter: Types.ObjectId[] | undefined,
  ): Promise<DashboardTimelineStatistics> {
    const propertyMatch = this.createPropertyMatch(propertyFilter);

    // Bookings by day
    const bookingsByDay: BookingDayAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const formattedBookingsByDay: Array<{
      date: string;
      bookings: number;
      revenue: number;
    }> = bookingsByDay.map((item: BookingDayAggregation) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(
        item._id.day,
      ).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // Bookings by week
    const bookingsByWeek: BookingWeekAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const formattedBookingsByWeek: Array<{
      week: string;
      bookings: number;
      revenue: number;
    }> = bookingsByWeek.map((item: BookingWeekAggregation) => ({
      week: `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // Bookings by month
    const bookingsByMonth: BookingMonthAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const formattedBookingsByMonth: Array<{
      month: string;
      bookings: number;
      revenue: number;
    }> = bookingsByMonth.map((item: BookingMonthAggregation) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      bookings: item.bookings,
      revenue: item.revenue,
    }));

    // User growth
    const newUsersByMonth: UserGrowthAggregation[] =
      await this.userModel.aggregate([
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
      ]);

    const formattedNewUsersByMonth: Array<{
      month: string;
      newUsers: number;
      totalUsers: number;
    }> = newUsersByMonth.map((item: UserGrowthAggregation) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      newUsers: item.newUsers,
      totalUsers: 0, // Will be calculated
    }));

    // Property growth
    const newPropertiesByMonth: PropertyGrowthAggregation[] =
      await this.propertyModel.aggregate([
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
      ]);

    const formattedNewPropertiesByMonth: Array<{
      month: string;
      newProperties: number;
      totalProperties: number;
    }> = newPropertiesByMonth.map((item: PropertyGrowthAggregation) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      newProperties: item.newProperties,
      totalProperties: 0, // Will be calculated
    }));

    // Review trends
    const reviewsByMonth: ReviewTrendAggregation[] =
      await this.reviewModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const formattedReviewsByMonth: Array<{
      month: string;
      reviews: number;
      averageRating: number;
    }> = reviewsByMonth.map((item: ReviewTrendAggregation) => ({
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
    propertyFilter: Types.ObjectId[] | undefined,
  ): Promise<DashboardPerformanceStatistics> {
    const propertyMatch = this.createPropertyMatch(propertyFilter);

    // Calculate total possible nights for the date range
    const startDate = new Date(dateFilter.created_at.$gte);
    const endDate = new Date(dateFilter.created_at.$lte);
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // Get total active listings for the properties
    const activeListingsCount = await this.listingModel.countDocuments({
      status: { $in: ['active', 'verified'] },
      ...propertyMatch,
    });

    const totalPossibleNights = totalDays * activeListingsCount;

    // Occupancy rates - calculate actual occupancy rate
    const occupancyStats: BookingStats[] = await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyMatch } },
      {
        $group: {
          _id: '$propertyId',
          totalNights: { $sum: '$nights' },
          average: { $avg: '$nights' },
        },
      },
    ]);

    const totalBookedNights = occupancyStats.reduce(
      (sum, item: BookingStats) => sum + item.totalNights,
      0,
    );

    const averageOccupancyRate =
      totalPossibleNights > 0
        ? (totalBookedNights / totalPossibleNights) * 100
        : 0;

    // Occupancy by property
    const occupancyByProperty: PropertyBookingStats[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    // Calculate occupancy rate for each property
    const formattedOccupancyByProperty: Array<{
      propertyId: string;
      propertyName: string;
      occupancyRate: number;
    }> = await Promise.all(
      occupancyByProperty.map(async (item: PropertyBookingStats) => {
        // Get active listings count for this property
        const propertyListingsCount = await this.listingModel.countDocuments({
          propertyId: item._id,
          status: { $in: ['active', 'verified'] },
        });

        const propertyPossibleNights = totalDays * propertyListingsCount;
        const propertyOccupancyRate =
          propertyPossibleNights > 0
            ? (item.totalNights / propertyPossibleNights) * 100
            : 0;

        return {
          propertyId: item._id.toString(),
          propertyName: item.propertyName,
          occupancyRate: Math.round(propertyOccupancyRate * 100) / 100, // Round to 2 decimal places
        };
      }),
    );

    // Booking patterns
    const bookingPatterns: BookingPatternAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
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
      ]);

    const patternData: BookingPatternAggregation = bookingPatterns[0] || {
      averageAdvanceBookingDays: 0,
      averageStayDuration: 0,
    };

    // Voucher performance
    const voucherPerformance: VoucherPerformanceAggregation[] =
      await this.voucherModel.aggregate([
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
      ]);

    const voucherData: VoucherPerformanceAggregation =
      voucherPerformance[0] || {
        voucherUsageRate: 0,
        averageVoucherDiscount: 0,
      };

    // Top vouchers
    const topVouchers: VoucherUsage[] = await this.voucherModel.aggregate([
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
    ]);

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
    const servicePerformance: ServicePerformanceAggregation[] =
      await this.bookingModel.aggregate([
        { $match: { ...dateFilter, ...propertyMatch } },
        {
          $group: {
            _id: null,
            averageServicesPerBooking: {
              $avg: { $size: '$selected_services' },
            },
          },
        },
      ]);

    const serviceData: ServicePerformanceAggregation =
      servicePerformance[0] || {
        averageServicesPerBooking: 0,
      };

    // Top services - calculate from booking data instead
    const topServices: ServiceUsage[] = await this.bookingModel.aggregate([
      { $match: { ...dateFilter, ...propertyMatch } },
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
    ]);

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
      averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100, // Round to 2 decimal places
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

  async getRealTimeStatistics(
    queryDto: QueryDashboardDto,
    user?: JwtPayload,
  ): Promise<DashboardRealTimeStatistics> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const onlineUsers = await this.userModel.countDocuments({
      updated_at: { $gte: last24Hours },
    });

    // Get property filter based on user role
    const propertyFilter = user
      ? await this.getPropertyFilter(user, queryDto.propertyId)
      : this.parsePropertyIds(queryDto.propertyId);

    const propertyFilterCondition = this.createPropertyMatch(propertyFilter);

    const activeBookings = await this.bookingModel.countDocuments({
      status: { $in: ['confirmed', 'pending'] },
      ...propertyFilterCondition,
    });

    const pendingBookings = await this.bookingModel.countDocuments({
      status: 'pending',
      ...propertyFilterCondition,
    });

    const recentMessages = await this.messageModel.countDocuments({
      created_at: { $gte: last24Hours },
      ...propertyFilterCondition,
    });

    const recentReviews = await this.reviewModel.countDocuments({
      created_at: { $gte: last24Hours },
      ...propertyFilterCondition,
    });

    const recentVoucherUsage = await this.voucherModel.countDocuments({
      updated_at: { $gte: last24Hours },
      ...propertyFilterCondition,
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
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter } }
      : {};

    const result: TotalAggregation[] = await this.bookingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$final_amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  private async calculateAveragePricePerNight(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter }, status: 'active' }
      : { status: 'active' };

    const result: AverageAggregation[] = await this.listingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, average: { $avg: '$price_per_night' } } },
    ]);
    return result[0]?.average || 0;
  }

  private async countVerifiedProperties(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const filter = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { _id: { $in: propertyFilter }, isVerified: true }
      : { isVerified: true };

    return this.propertyModel.countDocuments(filter);
  }

  private async calculateAverageRating(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter } }
      : {};

    const result: AverageAggregation[] = await this.reviewModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, average: { $avg: '$rating' } } },
    ]);
    return result[0]?.average || 0;
  }

  private async calculateTotalServicesRevenue(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter } }
      : {};

    const result: TotalAggregation[] = await this.bookingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$services_total_amount' } } },
    ]);
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
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { ...dateFilter, propertyId: { $in: propertyFilter } }
      : dateFilter;

    const result: ReturningCustomersAggregation[] =
      await this.bookingModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$customer', bookingCount: { $sum: 1 } } },
        { $match: { bookingCount: { $gt: 1 } } },
        { $count: 'returningCustomers' },
      ]);
    return result[0]?.returningCustomers || 0;
  }

  private async calculateTotalServiceFees(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter } }
      : {};

    const result: TotalAggregation[] = await this.bookingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$service_fee' } } },
    ]);
    return result[0]?.total || 0;
  }

  private async calculateTotalTaxAmount(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter } }
      : {};

    const result: TotalAggregation[] = await this.bookingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$tax_amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  private async calculateTotalRefunds(
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<number> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return 0;
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { propertyId: { $in: propertyFilter }, status: 'cancelled' }
      : { status: 'cancelled' };

    const result: TotalAggregation[] = await this.bookingModel.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: '$refund_amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getDashboardOverview(queryDto: QueryDashboardDto, user?: JwtPayload) {
    try {
      const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);
      const dateFilter: DateFilter = {
        created_at: { $gte: startDate, $lte: endDate },
      };

      const propertyFilter = user
        ? await this.getPropertyFilter(user, queryDto.propertyId)
        : this.parsePropertyIds(queryDto.propertyId);
      return this.getOverviewStatistics(dateFilter, propertyFilter, user);
    } catch (error) {
      this.logger.error('Error getting dashboard overview:', error);
      throw error;
    }
  }

  async getRevenueChartData(
    queryDto: RevenueChartDto,
    user?: JwtPayload,
  ): Promise<RevenueChartResponse> {
    try {
      const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);
      const dateFilter: DateFilter = {
        created_at: { $gte: startDate, $lte: endDate },
      };

      const propertyFilter = user
        ? await this.getPropertyFilter(user, queryDto.propertyId)
        : this.parsePropertyIds(queryDto.propertyId);

      // Debug logging
      this.logger.log(
        `Revenue Chart Request - DateRange: ${queryDto.dateRange}`,
      );
      this.logger.log(`Start Date: ${startDate.toISOString()}`);
      this.logger.log(`End Date: ${endDate.toISOString()}`);
      this.logger.log(`Property Filter: ${JSON.stringify(propertyFilter)}`);
      this.logger.log(`User Role: ${user?.role}`);

      const revenueData = await this.getRevenueDataByDate(
        dateFilter,
        propertyFilter,
        user,
      );

      const totalRevenue = revenueData.reduce(
        (sum, item) => sum + item.totalRevenue,
        0,
      );
      const averageDailyRevenue =
        revenueData.length > 0 ? totalRevenue / revenueData.length : 0;

      this.logger.log(`Revenue Data Count: ${revenueData.length}`);
      this.logger.log(`Total Revenue: ${totalRevenue}`);
      this.logger.log(`Revenue Data: ${JSON.stringify(revenueData)}`);

      return {
        data: revenueData,
        totalRevenue,
        averageDailyRevenue,
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
      };
    } catch (error) {
      this.logger.error('Error getting revenue chart data:', error);
      throw error;
    }
  }

  private getDateRangeFromQuery(
    queryDto: QueryDashboardDto | RevenueChartDto,
  ): {
    startDate: Date;
    endDate: Date;
  } {
    // Get current date in local timezone
    const now = new Date();

    // Create today's date at 00:00:00 in local timezone
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Create today's date at 23:59:59.999 in local timezone
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
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

      case DateRangeType.CUSTOM: {
        if (!queryDto.startDate || !queryDto.endDate) {
          throw new Error(
            'Start date and end date are required for custom date range',
          );
        }
        const customStart = new Date(queryDto.startDate + 'T00:00:00');
        const customEnd = new Date(queryDto.endDate + 'T23:59:59.999');
        return {
          startDate: customStart,
          endDate: customEnd,
        };
      }

      default: {
        // Default to last 30 days
        const defaultStart = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: defaultStart,
          endDate: todayEnd,
        };
      }
    }
  }

  private async getRevenueDataByDate(
    dateFilter: DateFilter,
    propertyFilter: Types.ObjectId[] | undefined,
    user?: JwtPayload,
  ): Promise<Array<{ date: string; totalRevenue: number }>> {
    if (
      this.shouldApplyPropertyFilter(user, propertyFilter) &&
      (!propertyFilter || propertyFilter.length === 0)
    ) {
      return [];
    }

    const matchStage = this.shouldApplyPropertyFilter(user, propertyFilter)
      ? { ...dateFilter, propertyId: { $in: propertyFilter } }
      : dateFilter;

    const result = await this.bookingModel.aggregate([
      { $match: matchStage },
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

    // Khai báo interface rõ ràng cho item
    interface RevenueItem {
      _id: {
        year: number;
        month: number;
        day: number;
      };
      totalRevenue: number;
    }

    // Create a map of existing revenue data
    const revenueMap = new Map<string, number>();

    result.forEach((item: unknown) => {
      // Kiểm tra kiểu an toàn trước khi thao tác
      if (
        typeof item === 'object' &&
        item !== null &&
        '_id' in item &&
        'totalRevenue' in item
      ) {
        const revenueItem = item as RevenueItem;

        const { year, month, day } = revenueItem._id;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const totalRevenue =
          typeof revenueItem.totalRevenue === 'number'
            ? revenueItem.totalRevenue
            : 0;

        revenueMap.set(date, totalRevenue);
      }
    });

    // Generate complete date range
    const startDate = new Date(dateFilter.created_at.$gte);
    const endDate = new Date(dateFilter.created_at.$lte);
    const completeData: Array<{ date: string; totalRevenue: number }> = [];

    // Iterate through each day in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      const revenue = revenueMap.get(dateString) || 0;

      completeData.push({
        date: dateString,
        totalRevenue: revenue,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return completeData;
  }
}
