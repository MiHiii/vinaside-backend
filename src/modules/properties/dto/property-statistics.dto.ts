import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum DateRangeType {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  CUSTOM = 'custom',
}

export class PropertyStatisticsQueryDto {
  @ApiPropertyOptional({
    description: 'Date range type for filtering',
    enum: DateRangeType,
    default: DateRangeType.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType = DateRangeType.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Start date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// Simplified chart data interface
export interface PropertyChartDataPoint {
  date: string;
  totalRevenue: number;
}

export interface PropertyDateRange {
  startDate: string;
  endDate: string;
}

// Enhanced interfaces for detailed statistics
export interface PropertyBookingPerformance {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  completedBookings: number;
  bookingSuccessRate: number;
  cancellationRate: number;
  averageBookingValue: number;
  averageStayDuration: number;
}

export interface PropertyOccupancyStats {
  occupancyRate: number;
  totalPossibleNights: number;
  totalBookedNights: number;
  averageAdvanceBookingDays: number;
}

export interface PropertyVoucherStats {
  totalVouchersUsed: number;
  totalVoucherDiscount: number;
  averageVoucherDiscount: number;
  voucherUsageRate: number;
  topVouchers: Array<{
    voucherId: string;
    voucherCode: string;
    usageCount: number;
    totalDiscount: number;
  }>;
}

export interface PropertyServiceStats {
  totalServicesUsed: number;
  serviceRevenue: number;
  averageServicesPerBooking: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    usageCount: number;
    totalRevenue: number;
  }>;
}

export interface PropertyReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [rating: number]: number };
}

export class PropertyStatisticsResponseDto {
  @ApiProperty({ description: 'ID của property' })
  propertyId: string;

  @ApiProperty({ description: 'Tên property' })
  propertyName: string;

  // Core statistics
  @ApiProperty({ description: 'Tổng số listing' })
  totalListings: number;

  @ApiProperty({ description: 'Số listing đang hoạt động' })
  activeListings: number;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Tổng số user đã booking' })
  totalUsers: number;

  // Detailed performance statistics
  @ApiProperty({ description: 'Thống kê hiệu suất booking' })
  bookingPerformance: PropertyBookingPerformance;

  @ApiProperty({ description: 'Thống kê tỉ lệ lấp đầy' })
  occupancyStats: PropertyOccupancyStats;

  @ApiProperty({ description: 'Thống kê voucher chi tiết' })
  voucherStats: PropertyVoucherStats;

  @ApiProperty({ description: 'Thống kê service chi tiết' })
  serviceStats: PropertyServiceStats;

  @ApiProperty({ description: 'Thống kê đánh giá' })
  reviewStats: PropertyReviewStats;

  @ApiProperty({ description: 'Dữ liệu biểu đồ doanh thu theo ngày' })
  chartData: PropertyChartDataPoint[];

  @ApiProperty({ description: 'Khoảng thời gian' })
  dateRange: PropertyDateRange;
}
