import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

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

export class ListingStatisticsDto {
  @ApiProperty({ description: 'ID của listing', required: false })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiProperty({ description: 'ID của property', required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({ description: 'Ngày bắt đầu thống kê', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Kiểu nhóm dữ liệu biểu đồ',
    enum: ListingChartGroupBy,
    required: false,
    default: ListingChartGroupBy.AUTO,
  })
  @IsOptional()
  @IsEnum(ListingChartGroupBy)
  groupBy?: ListingChartGroupBy = ListingChartGroupBy.AUTO;
}

export class ListingStatisticsResponseDto implements ListingStatistics {
  @ApiProperty({ description: 'ID của listing' })
  listingId: string;

  @ApiProperty({ description: 'Tên listing' })
  listingTitle: string;

  @ApiProperty({ description: 'Hiệu suất kinh doanh' })
  businessPerformance: {
    totalBookings: number;
    occupancyRate: number;
    monthlyRevenue: number;
    cancellationRate: number;
    returningGuests: number;
  };

  @ApiProperty({ description: 'Đánh giá' })
  reviews: {
    averageRating: number;
    totalReviews: number;
  };

  @ApiProperty({ description: 'Mức độ quan tâm & chuyển đổi' })
  engagement: {
    viewCount: number;
    wishlistCount: number;
  };

  @ApiProperty({ description: 'Tác động từ Voucher' })
  voucherImpact: {
    totalDiscountAmount: number;
    mostPopularVoucher: string;
  };

  @ApiProperty({
    description: 'Dữ liệu biểu đồ doanh thu 7 ngày gần nhất',
    type: [Object],
    required: false,
  })
  chartData?: ChartDataPoint[];
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
