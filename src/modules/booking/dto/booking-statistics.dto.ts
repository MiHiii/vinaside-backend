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
  // Voucher statistics
  totalVouchersUsed: number;
  totalVoucherDiscount: number;
  averageVoucherDiscount: number;
  voucherUsageRate: number;
  totalVoucherDiscountPercent: number;
  averageVoucherDiscountPercent: number;
  // Services statistics
  totalServicesRevenue: number;
  totalServicesBooked: number;
  averageServicesPerBooking: number;
  topServicesUsed: Array<{
    serviceId: string;
    serviceName: string;
    usageCount: number;
    totalRevenue: number;
  }>;
  // Top vouchers used
  topVouchersUsed: Array<{
    voucherId: string;
    voucherCode: string;
    usageCount: number;
    averageDiscountPercent: number;
    discountPercent: number;
  }>;
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

export interface PaymentStatusStatistics {
  unpaid: number;
  partially_paid: number;
  paid: number;
  refunding: number;
  refunded: number;
  failed: number;
}

export interface BookingFinancialStatistics {
  totalRevenue: number;
  totalServiceFees: number;
  totalTaxAmount: number;
  totalRefunds: number;
  netRevenue: number;
  averageBookingValue: number;
  // Voucher financial data
  totalVoucherDiscount: number;
  totalRevenueBeforeVoucher: number;
  voucherDiscountPercentage: number;
  // Services financial data
  totalServicesRevenue: number;
  servicesRevenuePercentage: number;
  averageServicesRevenuePerBooking: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
    voucherDiscount: number;
    servicesRevenue: number;
  }>;
}

export interface BookingCustomerStatistics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageNightsPerBooking: number;
  averageGuestsPerBooking: number;
  // Voucher usage by customers
  customersUsingVouchers: number;
  averageVoucherUsagePerCustomer: number;
  topVoucherUsers: Array<{
    customerId: string;
    customerName: string;
    voucherUsageCount: number;
    totalVoucherDiscount: number;
  }>;
  // Services usage by customers
  customersUsingServices: number;
  averageServicesUsagePerCustomer: number;
  topServicesUsers: Array<{
    customerId: string;
    customerName: string;
    servicesUsageCount: number;
    totalServicesSpent: number;
  }>;
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
}

export enum DateRangeType {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  CUSTOM = 'custom',
}

export class BookingStatisticsQueryDto {
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

  @ApiProperty({ description: 'Tổng số voucher đã sử dụng' })
  totalVouchersUsed: number;

  @ApiProperty({ description: 'Tổng tiền giảm giá từ voucher' })
  totalVoucherDiscount: number;

  @ApiProperty({ description: 'Trung bình giảm giá voucher' })
  averageVoucherDiscount: number;

  @ApiProperty({ description: 'Tỉ lệ sử dụng voucher (%)' })
  voucherUsageRate: number;

  @ApiProperty({ description: 'Tổng phần trăm giảm giá voucher' })
  totalVoucherDiscountPercent: number;

  @ApiProperty({ description: 'Trung bình phần trăm giảm giá voucher' })
  averageVoucherDiscountPercent: number;

  @ApiProperty({ description: 'Tổng doanh thu từ services' })
  totalServicesRevenue: number;

  @ApiProperty({ description: 'Tổng số services đã đặt' })
  totalServicesBooked: number;

  @ApiProperty({ description: 'Trung bình số services/booking' })
  averageServicesPerBooking: number;

  @ApiProperty({ description: 'Top services được sử dụng' })
  topServicesUsed: Array<{
    serviceId: string;
    serviceName: string;
    usageCount: number;
    totalRevenue: number;
  }>;

  @ApiProperty({ description: 'Top vouchers được sử dụng' })
  topVouchersUsed: Array<{
    voucherId: string;
    voucherCode: string;
    usageCount: number;
    averageDiscountPercent: number;
    discountPercent: number;
  }>;

  @ApiProperty({ description: 'Thống kê theo trạng thái booking' })
  statusBreakdown: BookingStatusStatistics;

  @ApiProperty({ description: 'Thống kê theo trạng thái thanh toán' })
  paymentStatusBreakdown: PaymentStatusStatistics;

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

  @ApiProperty({ description: 'Tổng tiền giảm giá từ voucher' })
  totalVoucherDiscount: number;

  @ApiProperty({ description: 'Tổng doanh thu trước khi giảm giá voucher' })
  totalRevenueBeforeVoucher: number;

  @ApiProperty({ description: 'Tỉ lệ giảm giá voucher (%)' })
  voucherDiscountPercentage: number;

  @ApiProperty({ description: 'Tổng doanh thu từ services' })
  totalServicesRevenue: number;

  @ApiProperty({ description: 'Tỉ lệ doanh thu từ services (%)' })
  servicesRevenuePercentage: number;

  @ApiProperty({ description: 'Trung bình doanh thu services/booking' })
  averageServicesRevenuePerBooking: number;

  @ApiProperty({ description: 'Doanh thu theo tháng' })
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    bookings: number;
    voucherDiscount: number;
    servicesRevenue: number;
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

  @ApiProperty({ description: 'Số khách hàng sử dụng voucher' })
  customersUsingVouchers: number;

  @ApiProperty({ description: 'Trung bình số lần sử dụng voucher/khách' })
  averageVoucherUsagePerCustomer: number;

  @ApiProperty({ description: 'Top khách hàng sử dụng voucher' })
  topVoucherUsers: Array<{
    customerId: string;
    customerName: string;
    voucherUsageCount: number;
    totalVoucherDiscount: number;
  }>;

  @ApiProperty({ description: 'Số khách hàng sử dụng services' })
  customersUsingServices: number;

  @ApiProperty({ description: 'Trung bình số lần sử dụng services/khách' })
  averageServicesUsagePerCustomer: number;

  @ApiProperty({ description: 'Top khách hàng sử dụng services' })
  topServicesUsers: Array<{
    customerId: string;
    customerName: string;
    servicesUsageCount: number;
    totalServicesSpent: number;
  }>;

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
