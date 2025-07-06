import { ApiProperty } from '@nestjs/swagger';
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

export class PropertyStatisticsQueryDto {
  @ApiProperty({ description: 'Ngày bắt đầu thống kê', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
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
}
