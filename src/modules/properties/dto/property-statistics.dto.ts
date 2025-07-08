import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export interface PropertyOverviewStatistics {
  totalRooms: number;
  activeRooms: number;
  roomsWithBookings: number;
  roomsWithoutBookings: number;
  totalBookings: number;
  successfulBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  averageOccupancyRate: number;
  totalRevenue: number;
  averagePricePerNight: number;
  averageStayDuration: number;
}

export interface PropertyVoucherStatistics {
  totalVouchersUsed: number;
  totalDiscountAmount: number;
  averageDiscountPerBooking: number;
  mostPopularVoucher: string;
  voucherUsageByMonth: Array<{
    month: string;
    vouchersUsed: number;
    totalDiscount: number;
  }>;
  topVouchers: Array<{
    voucherCode: string;
    usageCount: number;
    totalDiscount: number;
  }>;
}

export interface PropertyServiceStatistics {
  totalServices: number;
  activeServices: number;
  totalServiceRevenue: number;
  averageServicePrice: number;
  mostPopularService: string;
  serviceUsageByMonth: Array<{
    month: string;
    servicesUsed: number;
    revenue: number;
  }>;
  topServices: Array<{
    serviceName: string;
    usageCount: number;
    revenue: number;
  }>;
}

export interface PropertyFinancialStatistics {
  totalRevenue: number;
  totalServiceFees: number;
  totalTaxAmount: number;
  totalDiscountAmount: number;
  netRevenue: number;
  averageBookingValue: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
    services: number;
    vouchers: number;
  }>;
}

export interface PropertyTimelineStatistics {
  bookingsByDay: Array<{
    date: string;
    bookings: number;
    revenue: number;
    services: number;
  }>;
  bookingsByWeek: Array<{
    week: string;
    bookings: number;
    revenue: number;
    services: number;
  }>;
  bookingsByMonth: Array<{
    month: string;
    bookings: number;
    revenue: number;
    services: number;
  }>;
  averageAdvanceBookingDays: number;
  averageStayDuration: number;
}

export enum PropertyChartGroupBy {
  AUTO = 'auto',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export interface PropertyChartDataPoint {
  label: string; // label cho trục X (ngày/tuần/tháng)
  revenue: number;
  bookings: number;
  occupancyRate: number;
}

export class PropertyStatisticsQueryDto {
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Cách nhóm dữ liệu',
    enum: ['auto', 'day', 'week', 'month', 'year'],
    example: 'auto',
  })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class PropertyStatisticsResponseDto {
  @ApiProperty({ description: 'ID của property' })
  propertyId: string;

  @ApiProperty({ description: 'Tên property' })
  propertyName: string;

  @ApiProperty({ description: 'Thống kê tổng quan' })
  overview: PropertyOverviewStatistics;

  @ApiProperty({ description: 'Thống kê voucher' })
  vouchers: PropertyVoucherStatistics;

  @ApiProperty({ description: 'Thống kê dịch vụ' })
  services: PropertyServiceStatistics;

  @ApiProperty({
    description: 'Dữ liệu biểu đồ doanh thu/ngày',
    type: [Object],
    required: false,
  })
  chartData?: PropertyChartDataPoint[];
}
