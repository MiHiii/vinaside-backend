import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum DateRangeType {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  CUSTOM = 'custom',
}

export enum TimeGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export interface ListingStatistics {
  listingId: string;
  listingTitle: string;
  businessPerformance: {
    totalBookings: number;
    occupancyRate: number;
    monthlyRevenue: number;
    cancellationRate: number;
    returningGuests: number;
  };
  reviews: {
    averageRating: number;
    totalReviews: number;
  };
  engagement: {
    viewCount: number;
    wishlistCount: number;
  };
  voucherImpact: {
    totalDiscountAmount: number;
    mostPopularVoucher: string;
  };
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  bookings: number;
  occupancyRate: number;
}

export interface ListingRevenueStatistics {
  listingId: string;
  listingTitle: string;
  totalRevenue: number;
  totalBookings: number;
  averageOccupancyRate: number;
  chartData: RevenueChartData[];
}

export enum ListingChartGroupBy {
  AUTO = 'auto',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export interface ChartDataPoint {
  label: string; // label cho trục X (ngày/tuần/tháng)
  revenue: number;
  bookings: number;
  occupancyRate: number;
}

// Simplified chart data interface similar to properties
export interface ListingChartDataPoint {
  date: string;
  totalRevenue: number;
}

export interface ListingDateRange {
  startDate: string;
  endDate: string;
}

export class ListingStatisticsDto {
  @ApiProperty({
    description: 'Date range type for filtering',
    enum: DateRangeType,
    default: DateRangeType.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType = DateRangeType.LAST_30_DAYS;

  @ApiProperty({
    description: 'Start date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// Simplified response DTO - not too detailed as requested
// Detailed voucher and service stats interfaces
export interface ListingVoucherDetail {
  voucherId: string;
  voucherCode: string;
  usageCount: number;
  totalDiscount: number;
  averageDiscount: number;
}

export interface ListingServiceDetail {
  serviceId: string;
  serviceName: string;
  usageCount: number;
  totalRevenue: number;
  averagePrice: number;
}

export class ListingStatisticsResponseDto {
  @ApiProperty({ description: 'ID của listing' })
  listingId: string;

  @ApiProperty({ description: 'Tên listing' })
  listingTitle: string;

  @ApiProperty({ description: 'Tổng số booking' })
  totalBookings: number;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Tỉ lệ lấp đầy (%)' })
  occupancyRate: number;

  @ApiProperty({ description: 'Tổng số lượt xem' })
  totalViews: number;

  @ApiProperty({ description: 'Tổng số đánh giá' })
  totalReviews: number;

  @ApiProperty({ description: 'Rating trung bình' })
  averageRating: number;

  @ApiProperty({ description: 'Số lần được thêm vào wishlist' })
  wishlistCount: number;

  @ApiProperty({ description: 'Tổng giảm giá từ voucher' })
  totalVoucherDiscount: number;

  @ApiProperty({ description: 'Số lượng voucher đã sử dụng' })
  totalVouchersUsed: number;

  @ApiProperty({ description: 'Chi tiết các voucher được sử dụng' })
  voucherDetails: ListingVoucherDetail[];

  @ApiProperty({ description: 'Tổng doanh thu từ service' })
  totalServiceRevenue: number;

  @ApiProperty({ description: 'Số lượng service đã sử dụng' })
  totalServicesUsed: number;

  @ApiProperty({ description: 'Chi tiết các service được sử dụng' })
  serviceDetails: ListingServiceDetail[];

  @ApiProperty({ description: 'Dữ liệu biểu đồ doanh thu theo ngày' })
  chartData: ListingChartDataPoint[];

  @ApiProperty({ description: 'Khoảng thời gian' })
  dateRange: ListingDateRange;
}

export class ListingRevenueStatisticsResponseDto
  implements ListingRevenueStatistics
{
  @ApiProperty({ description: 'ID của listing' })
  listingId: string;

  @ApiProperty({ description: 'Tên listing' })
  listingTitle: string;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Tổng số booking' })
  totalBookings: number;

  @ApiProperty({ description: 'Tỷ lệ lấp đầy trung bình' })
  averageOccupancyRate: number;

  @ApiProperty({
    description: 'Dữ liệu biểu đồ theo thời gian',
    type: [Object],
  })
  chartData: RevenueChartData[];
}
