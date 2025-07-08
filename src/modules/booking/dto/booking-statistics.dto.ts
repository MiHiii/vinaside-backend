import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export interface BookingOverviewStatistics {
  totalBookings: number;
  totalRevenue: number;
  totalNights: number;
  averageOccupancyRate: number;
  averageBookingValue: number;
  totalGuests: number;
  totalInfants: number;
}

export interface BookingStatusStatistics {
  pending: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  rejected: number;
  confirmationRate: number;
  cancellationRate: number;
}

export interface BookingFinancialStatistics {
  totalRevenue: number;
  totalServiceFees: number;
  totalTaxAmount: number;
  totalRefunds: number;
  netRevenue: number;
  averageBookingValue: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
}

export interface BookingCustomerStatistics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageNightsPerBooking: number;
  averageGuestsPerBooking: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalBookings: number;
    totalSpent: number;
  }>;
}

export interface BookingTimelineStatistics {
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
  averageAdvanceBookingDays: number;
  averageStayDuration: number;
}

export enum BookingChartGroupBy {
  AUTO = 'auto',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export interface BookingChartDataPoint {
  label: string; // label cho trục X (ngày/tuần/tháng)
  revenue: number;
  bookings: number;
  occupancyRate: number;
}

export class BookingStatisticsQueryDto {
  @ApiProperty({ description: 'Ngày bắt đầu thống kê', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'ID của property', required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({ description: 'ID của listing', required: false })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiProperty({
    description: 'Kiểu nhóm dữ liệu biểu đồ',
    enum: BookingChartGroupBy,
    required: false,
    default: BookingChartGroupBy.AUTO,
  })
  @IsOptional()
  @IsEnum(BookingChartGroupBy)
  groupBy?: BookingChartGroupBy = BookingChartGroupBy.AUTO;
}

export class BookingOverviewResponseDto implements BookingOverviewStatistics {
  @ApiProperty({ description: 'Tổng số booking' })
  totalBookings: number;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Tổng số đêm đã đặt' })
  totalNights: number;

  @ApiProperty({ description: 'Tỉ lệ lấp đầy trung bình (%)' })
  averageOccupancyRate: number;

  @ApiProperty({ description: 'Giá trị booking trung bình' })
  averageBookingValue: number;

  @ApiProperty({ description: 'Tổng số khách' })
  totalGuests: number;

  @ApiProperty({ description: 'Tổng số trẻ em' })
  totalInfants: number;

  @ApiProperty({ description: 'Thống kê theo trạng thái' })
  statusBreakdown: BookingStatusStatistics;

  @ApiProperty({
    description: 'Dữ liệu biểu đồ doanh thu/ngày',
    type: [Object],
    required: false,
  })
  chartData?: BookingChartDataPoint[];
}

export class BookingFinancialResponseDto implements BookingFinancialStatistics {
  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Tổng phí dịch vụ' })
  totalServiceFees: number;

  @ApiProperty({ description: 'Tổng thuế' })
  totalTaxAmount: number;

  @ApiProperty({ description: 'Tổng tiền hoàn trả' })
  totalRefunds: number;

  @ApiProperty({ description: 'Doanh thu ròng' })
  netRevenue: number;

  @ApiProperty({ description: 'Giá trị booking trung bình' })
  averageBookingValue: number;

  @ApiProperty({ description: 'Doanh thu theo tháng' })
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
}

export class BookingCustomerResponseDto implements BookingCustomerStatistics {
  @ApiProperty({ description: 'Tổng số khách hàng' })
  totalCustomers: number;

  @ApiProperty({ description: 'Số khách hàng mới' })
  newCustomers: number;

  @ApiProperty({ description: 'Số khách hàng quay lại' })
  returningCustomers: number;

  @ApiProperty({ description: 'Trung bình số đêm/booking' })
  averageNightsPerBooking: number;

  @ApiProperty({ description: 'Trung bình số khách/booking' })
  averageGuestsPerBooking: number;

  @ApiProperty({ description: 'Top khách hàng' })
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalBookings: number;
    totalSpent: number;
  }>;
}

export class BookingTimelineResponseDto implements BookingTimelineStatistics {
  @ApiProperty({ description: 'Booking theo ngày' })
  bookingsByDay: Array<{
    date: string;
    bookings: number;
    revenue: number;
  }>;

  @ApiProperty({ description: 'Booking theo tuần' })
  bookingsByWeek: Array<{
    week: string;
    bookings: number;
    revenue: number;
  }>;

  @ApiProperty({ description: 'Booking theo tháng' })
  bookingsByMonth: Array<{
    month: string;
    bookings: number;
    revenue: number;
  }>;

  @ApiProperty({ description: 'Trung bình số ngày đặt trước' })
  averageAdvanceBookingDays: number;

  @ApiProperty({ description: 'Thời gian lưu trú trung bình (ngày)' })
  averageStayDuration: number;
}
