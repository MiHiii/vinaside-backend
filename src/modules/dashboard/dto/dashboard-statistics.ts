import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

// ==================== OVERVIEW STATISTICS ====================
export interface DashboardOverviewStatistics {
  // User statistics
  totalUsers: number;
  usersByRole: {
    guest: number;
    staff: number;
    admin: number;
  };
  newUsersLast30Days: number;

  // Property statistics
  totalProperties: number;
  activeProperties: number;
  verifiedProperties: number;
  propertiesByStatus: {
    active: number;
    inactive: number;
    pending: number;
  };

  // Listing statistics
  totalListings: number;
  activeListings: number;
  averagePricePerNight: number;
  listingsByStatus: {
    active: number;
    inactive: number;
    draft: number;
  };

  // Booking statistics
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  bookingsByStatus: {
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
    rejected: number;
  };

  // Review statistics
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [rating: number]: number };

  // Voucher statistics
  totalVouchers: number;
  activeVouchers: number;
  usedVouchers: number;
  totalVoucherDiscount: number;

  // Service statistics
  totalServices: number;
  activeServices: number;
  totalServicesRevenue: number;

  // Message statistics
  totalMessages: number;
  totalConversations: number;
  totalReactions: number;

  // Wishlist statistics
  totalWishlists: number;
  totalWishlistItems: number;
}

// ==================== FINANCIAL STATISTICS ====================
export interface DashboardFinancialStatistics {
  totalRevenue: number;
  totalServiceFees: number;
  totalTaxAmount: number;
  totalRefunds: number;
  netRevenue: number;

  // Voucher financial data
  totalVoucherDiscount: number;
  totalRevenueBeforeVoucher: number;
  voucherDiscountPercentage: number;

  // Services financial data
  totalServicesRevenue: number;
  servicesRevenuePercentage: number;

  // Revenue by time period
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
    voucherDiscount: number;
    servicesRevenue: number;
  }>;

  // Top performing properties
  topPropertiesByRevenue: Array<{
    propertyId: string;
    propertyName: string;
    revenue: number;
    bookings: number;
  }>;
}

// ==================== CUSTOMER STATISTICS ====================
export interface DashboardCustomerStatistics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;

  // Customer engagement
  averageNightsPerBooking: number;
  averageGuestsPerBooking: number;
  customersUsingVouchers: number;
  customersUsingServices: number;

  // Top customers
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalBookings: number;
    totalSpent: number;
  }>;

  // Customer satisfaction
  averageRating: number;
  totalReviews: number;
  positiveReviews: number; // 4-5 stars
  negativeReviews: number; // 1-2 stars
}

// ==================== TIMELINE STATISTICS ====================
export interface DashboardTimelineStatistics {
  // Bookings by time
  bookingsByDay: Array<{
    date: string;
    bookings: number;
    revenue: number;
  }>;
  bookingsByWeek: Array<{
    week: string;
    bookings: number;
    revenue: number;
  }>;
  bookingsByMonth: Array<{
    month: string;
    bookings: number;
    revenue: number;
  }>;

  // User growth
  newUsersByMonth: Array<{
    month: string;
    newUsers: number;
    totalUsers: number;
  }>;

  // Property growth
  newPropertiesByMonth: Array<{
    month: string;
    newProperties: number;
    totalProperties: number;
  }>;

  // Review trends
  reviewsByMonth: Array<{
    month: string;
    reviews: number;
    averageRating: number;
  }>;
}

// ==================== PERFORMANCE STATISTICS ====================
export interface DashboardPerformanceStatistics {
  // Occupancy rates
  averageOccupancyRate: number;
  occupancyByProperty: Array<{
    propertyId: string;
    propertyName: string;
    occupancyRate: number;
  }>;

  // Booking patterns
  averageAdvanceBookingDays: number;
  averageStayDuration: number;

  // Voucher performance
  voucherUsageRate: number;
  averageVoucherDiscount: number;
  topVouchers: Array<{
    voucherId: string;
    voucherCode: string;
    usageCount: number;
    totalDiscount: number;
  }>;

  // Service performance
  averageServicesPerBooking: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    usageCount: number;
    totalRevenue: number;
  }>;
}

// ==================== REAL-TIME STATISTICS ====================
export interface DashboardRealTimeStatistics {
  onlineUsers: number;
  activeBookings: number;
  pendingBookings: number;
  recentMessages: number; // Last 24 hours
  recentReviews: number; // Last 24 hours
  recentVoucherUsage: number; // Last 24 hours
}

export class RevenueChartData {
  date: string;
  totalRevenue: number;
}

export class RevenueChartResponse {
  data: RevenueChartData[];
  totalRevenue: number;
  averageDailyRevenue: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// ==================== MAIN DASHBOARD RESPONSE ====================
export interface DashboardStatistics {
  overview: DashboardOverviewStatistics;
  financial: DashboardFinancialStatistics;
  customers: DashboardCustomerStatistics;
  timeline: DashboardTimelineStatistics;
  performance: DashboardPerformanceStatistics;
  realTime: DashboardRealTimeStatistics;
}

// ==================== DTO CLASSES ====================
export enum DashboardChartGroupBy {
  AUTO = 'auto',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class DashboardStatisticsQueryDto {
  @ApiProperty({ description: 'Ngày bắt đầu thống kê', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'ID của property (filter)', required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({
    description: 'Kiểu nhóm dữ liệu biểu đồ',
    enum: DashboardChartGroupBy,
    required: false,
    default: DashboardChartGroupBy.AUTO,
  })
  @IsOptional()
  @IsEnum(DashboardChartGroupBy)
  groupBy?: DashboardChartGroupBy = DashboardChartGroupBy.AUTO;
}

export class DashboardOverviewResponseDto
  implements DashboardOverviewStatistics
{
  @ApiProperty({ description: 'Tổng số người dùng' })
  totalUsers: number;

  @ApiProperty({ description: 'Người dùng theo role' })
  usersByRole: {
    guest: number;
    staff: number;
    admin: number;
  };

  @ApiProperty({ description: 'Người dùng mới trong 30 ngày' })
  newUsersLast30Days: number;

  @ApiProperty({ description: 'Tổng số properties' })
  totalProperties: number;

  @ApiProperty({ description: 'Properties đang hoạt động' })
  activeProperties: number;

  @ApiProperty({ description: 'Properties đã xác minh' })
  verifiedProperties: number;

  @ApiProperty({ description: 'Properties theo trạng thái' })
  propertiesByStatus: {
    active: number;
    inactive: number;
    pending: number;
  };

  @ApiProperty({ description: 'Tổng số listings' })
  totalListings: number;

  @ApiProperty({ description: 'Listings đang hoạt động' })
  activeListings: number;

  @ApiProperty({ description: 'Giá trung bình/đêm' })
  averagePricePerNight: number;

  @ApiProperty({ description: 'Listings theo trạng thái' })
  listingsByStatus: {
    active: number;
    inactive: number;
    draft: number;
  };

  @ApiProperty({ description: 'Tổng số bookings' })
  totalBookings: number;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Giá trị booking trung bình' })
  averageBookingValue: number;

  @ApiProperty({ description: 'Bookings theo trạng thái' })
  bookingsByStatus: {
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
    rejected: number;
  };

  @ApiProperty({ description: 'Tổng số reviews' })
  totalReviews: number;

  @ApiProperty({ description: 'Đánh giá trung bình' })
  averageRating: number;

  @ApiProperty({ description: 'Phân bố rating' })
  ratingDistribution: { [rating: number]: number };

  @ApiProperty({ description: 'Tổng số vouchers' })
  totalVouchers: number;

  @ApiProperty({ description: 'Vouchers đang hoạt động' })
  activeVouchers: number;

  @ApiProperty({ description: 'Vouchers đã sử dụng' })
  usedVouchers: number;

  @ApiProperty({ description: 'Tổng tiền giảm giá voucher' })
  totalVoucherDiscount: number;

  @ApiProperty({ description: 'Tổng số services' })
  totalServices: number;

  @ApiProperty({ description: 'Services đang hoạt động' })
  activeServices: number;

  @ApiProperty({ description: 'Tổng doanh thu services' })
  totalServicesRevenue: number;

  @ApiProperty({ description: 'Tổng số tin nhắn' })
  totalMessages: number;

  @ApiProperty({ description: 'Tổng số cuộc trò chuyện' })
  totalConversations: number;

  @ApiProperty({ description: 'Tổng số reactions' })
  totalReactions: number;

  // Wishlist statistics
  @ApiProperty({ description: 'Tổng số wishlists' })
  totalWishlists: number;

  @ApiProperty({ description: 'Tổng số mục trong wishlists' })
  totalWishlistItems: number;
}

export class DashboardStatisticsResponseDto implements DashboardStatistics {
  @ApiProperty({ description: 'Thống kê tổng quan' })
  overview: DashboardOverviewResponseDto;

  @ApiProperty({ description: 'Thống kê tài chính' })
  financial: DashboardFinancialStatistics;

  @ApiProperty({ description: 'Thống kê khách hàng' })
  customers: DashboardCustomerStatistics;

  @ApiProperty({ description: 'Thống kê theo thời gian' })
  timeline: DashboardTimelineStatistics;

  @ApiProperty({ description: 'Thống kê hiệu suất' })
  performance: DashboardPerformanceStatistics;

  @ApiProperty({ description: 'Thống kê real-time' })
  realTime: DashboardRealTimeStatistics;
}
