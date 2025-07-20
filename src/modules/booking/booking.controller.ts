import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { VNPayService } from './services/vnpay.service';
import { PaymentFactory } from './services/payment.factory';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  PaymentStatusDto,
} from './dto/payment.dto';
import { CreatePaymentRequest } from './interfaces/payment-service.interface';

import { PaymentMethod } from '../transactions/schemas/transaction.schema';
import {
  BookingStatisticsQueryDto,
  BookingOverviewResponseDto,
} from './dto/booking-statistics.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { RequirePropertyStaff } from '../../decorators/require-property-staff.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PropertyStaffGuard } from '../../common/guards/property-staff.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BookingStatus } from './schemas/booking.schema';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { Roles } from 'src/decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Booking Management')
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard, RolesGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly vnpayService: VNPayService,
    private readonly paymentFactory: PaymentFactory,
  ) {}

  @Post()
  @Roles('guest')
  @ApiOperation({ summary: 'Tạo booking mới' })
  @ApiResponse({ status: 201, description: 'Booking được tạo thành công' })
  @ResponseMessage('Tạo booking thành công')
  create(
    @Body() createBookingDto: CreateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.create(
      createBookingDto,
      req.user as any as JwtPayload,
    );
  }

  @Get()
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy danh sách tất cả bookings (Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách bookings' })
  @ResponseMessage('Lấy danh sách bookings thành công')
  findAll(@Query() queryDto: QueryBookingDto) {
    return this.bookingService.findAll(queryDto);
  }

  @Get('my-bookings')
  @Roles('guest')
  @ApiOperation({ summary: 'Lấy booking của tôi (Guest)' })
  @ApiResponse({ status: 200, description: 'Danh sách booking của user' })
  @ResponseMessage('Lấy danh sách booking của tôi thành công')
  getMyBookings(
    @Query() query: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findByGuest(req.user._id, query);
  }

  @Get('my-history')
  @Roles('guest', 'admin')
  @ApiOperation({ summary: 'Lấy lịch sử booking' })
  @ApiResponse({ status: 200, description: 'Lịch sử booking' })
  @ResponseMessage('Lấy lịch sử booking của tôi thành công')
  findMyHistory(
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findMyBookingsAsGuest(req.user, queryDto);
  }

  @Get('guest/:guestId')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy bookings của guest cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách bookings của guest' })
  @ResponseMessage('Lấy danh sách bookings của guest thành công')
  findByGuest(
    @Param('guestId') guestId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByGuest(guestId, queryDto);
  }

  @Get('staff/:staffId')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy bookings của staff cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách bookings của staff' })
  @ResponseMessage('Lấy danh sách bookings của staff thành công')
  findByStaff(
    @Param('staffId') staffId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByHost(staffId, queryDto);
  }

  @Get('property/:propertyId/listing/:listingId')
  @RequirePermission('booking.view')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Lấy bookings của listing cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách bookings của listing' })
  @ResponseMessage('Lấy danh sách bookings của listing thành công')
  findByListing(
    @Param('propertyId') propertyId: string,
    @Param('listingId') listingId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByListing(listingId, queryDto);
  }

  @Get('check-availability/:listingId')
  @Public()
  @ApiOperation({ summary: 'Kiểm tra tính khả dụng của listing' })
  @ApiResponse({ status: 200, description: 'Thông tin khả dụng' })
  @ResponseMessage('Kiểm tra tính khả dụng thành công')
  checkAvailability(
    @Param('listingId') listingId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.bookingService.checkAvailability(listingId, checkIn, checkOut);
  }

  @Public()
  @Get('booked-dates/:listingId')
  @ApiOperation({ summary: 'Lấy ngày đã được đặt của listing' })
  @ApiResponse({ status: 200, description: 'Danh sách ngày đã đặt' })
  @ResponseMessage('Lấy ngày đã đặt thành công')
  getBookedDates(@Param('listingId') listingId: string) {
    return this.bookingService.getBookedDates(listingId);
  }

  @Get('property/:propertyId/:id')
  @Roles('guest', 'staff', 'admin')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết booking' })
  @ApiResponse({ status: 200, description: 'Thông tin booking' })
  @ResponseMessage('Lấy thông tin booking thành công')
  findOne(@Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch('property/:propertyId/:id')
  @RequirePermission('booking.edit')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Cập nhật thông tin booking' })
  @ApiResponse({ status: 200, description: 'Booking được cập nhật thành công' })
  @ResponseMessage('Cập nhật booking thành công')
  update(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.update(
      id,
      updateBookingDto,
      req.user as any as JwtPayload,
    );
  }

  @Delete('property/:propertyId/:id')
  @RequirePermission('booking.cancel')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Hủy booking' })
  @ApiResponse({ status: 200, description: 'Booking được hủy thành công' })
  @ResponseMessage('Hủy booking thành công')
  cancel(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.remove(id, req.user as any as JwtPayload);
  }

  @Patch('property/:propertyId/:id/confirm')
  @RequirePermission('booking.confirm')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Xác nhận booking' })
  @ApiResponse({ status: 200, description: 'Booking được xác nhận thành công' })
  @ResponseMessage('Xác nhận booking thành công')
  confirm(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.updateStatus(
      id,
      BookingStatus.CONFIRMED,
      req.user as any as JwtPayload,
    );
  }

  // =================== GENERIC PAYMENT ENDPOINTS ===================

  @Post(':id/payment')
  @Roles('guest')
  @ApiOperation({ summary: 'Tạo payment URL (hỗ trợ VNPay & MoMo)' })
  @ApiResponse({
    status: 200,
    description: 'Payment URL được tạo thành công',
    type: PaymentResponseDto,
  })
  @ResponseMessage('Tạo payment URL thành công')
  async createPayment(
    @Param('id') bookingId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    createPaymentDto.bookingId = bookingId;
    const paymentService = this.paymentFactory.getPaymentService(
      createPaymentDto.paymentMethod,
    );

    // Convert to CreatePaymentRequest
    const request: CreatePaymentRequest = {
      ...createPaymentDto,
      bookingId, // Use bookingId from URL params
      amount: 0, // Will be fetched from booking
    };

    const result = await paymentService.createPaymentUrl(request);

    return {
      success: result.success,
      paymentMethod: result.paymentMethod,
      paymentUrl: result.paymentUrl,
      deeplink: undefined, // Will be set by specific gateways
      qrCodeUrl: undefined, // Will be set by specific gateways
      orderId: result.orderId,
      amount: result.amount,
      message: result.message,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
    };
  }

  @Get('payment/supported-methods')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách phương thức thanh toán được hỗ trợ' })
  @ApiResponse({ status: 200, description: 'Danh sách phương thức thanh toán' })
  @ResponseMessage('Lấy danh sách phương thức thanh toán thành công')
  getSupportedPaymentMethods() {
    return {
      supportedMethods: this.paymentFactory.getSupportedPaymentMethods(),
      default: PaymentMethod.VNPAY,
    };
  }

  @Get(':id/payment/status')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Kiểm tra trạng thái thanh toán của booking' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái thanh toán',
    type: PaymentStatusDto,
  })
  @ResponseMessage('Lấy trạng thái thanh toán thành công')
  async getPaymentStatus(
    @Param('id') bookingId: string,
  ): Promise<PaymentStatusDto> {
    // Get booking info first to determine payment method
    const booking = await this.bookingService.findOne(bookingId);
    const paymentMethod = booking.payment_method as PaymentMethod;

    if (
      !paymentMethod ||
      !this.paymentFactory.isPaymentMethodSupported(paymentMethod)
    ) {
      return {
        bookingId,
        paymentStatus: booking.payment_status || 'pending',
        amount: booking.final_amount || 0,
      };
    }

    // Get detailed status from payment gateway
    const paymentService = this.paymentFactory.getPaymentService(paymentMethod);
    const orderId =
      paymentMethod === PaymentMethod.VNPAY
        ? booking.vnpay_order_id || `${bookingId}_unknown`
        : booking.momo_order_id || `${bookingId}_unknown`;

    try {
      const result = await paymentService.getPaymentStatus(orderId);
      return {
        bookingId: result.bookingId,
        paymentMethod: result.paymentMethod,
        paymentStatus: booking.payment_status || 'pending',
        amount: result.amount,
        gatewayTransactionId: result.gatewayTransactionId,
        paidAt: result.paidAt,
        gatewayDetails: result.metadata,
      };
    } catch {
      // Fallback to booking info if gateway fails
      return {
        bookingId,
        paymentMethod,
        paymentStatus: booking.payment_status || 'pending',
        amount: booking.final_amount || 0,
      };
    }
  }

  // =================== STATISTICS ENDPOINTS ===================

  @Get('statistics/overview')
  @RequirePermission('booking.view_statistics')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan booking' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê tổng quan booking được trả về thành công.',
    type: BookingOverviewResponseDto,
  })
  @ResponseMessage('Lấy thống kê tổng quan booking thành công')
  async getOverviewStatistics(@Query() query: BookingStatisticsQueryDto) {
    return this.bookingService.getOverviewStatistics(
      query.startDate,
      query.endDate,
      query.propertyId,
      query.listingId,
    );
  }

  @Get('statistics/detailed')
  @RequirePermission('booking.view_statistics')
  @ApiOperation({
    summary:
      'Lấy thống kê chi tiết booking (financial, customers, vouchers, services)',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê chi tiết được trả về thành công.',
  })
  @ResponseMessage('Lấy thống kê chi tiết thành công')
  getDetailedStatistics(
    @Query() query: BookingStatisticsQueryDto,
    @Query('type') type: 'financial' | 'customers' | 'all' = 'all',
  ): Promise<any> {
    return this.bookingService.getDetailedStatistics(
      query.startDate,
      query.endDate,
      query.propertyId,
      query.listingId,
      type,
    );
  }

  @Get('statistics/user-analytics')
  @RequirePermission('booking.view_statistics')
  @ApiOperation({ summary: 'Lấy phân tích hành vi user (services, vouchers)' })
  @ApiResponse({
    status: 200,
    description: 'Phân tích hành vi user được trả về thành công.',
  })
  @ResponseMessage('Lấy phân tích hành vi user thành công')
  getUserAnalytics(
    @Query() query: BookingStatisticsQueryDto,
    @Query('type') type: 'services' | 'vouchers' | 'all' = 'all',
  ): Promise<any> {
    return this.bookingService.getUserAnalytics(
      query.startDate,
      query.endDate,
      query.propertyId,
      query.listingId,
      type,
    );
  }

  // =================== VNPAY CALLBACK ENDPOINTS ===================

  @Post('vnpay/ipn')
  @Public()
  @ApiOperation({ summary: 'VNPay IPN callback' })
  @ApiResponse({ status: 200, description: 'IPN processed' })
  async handleVNPayIPN(@Body() callbackData: any) {
    const result = await this.vnpayService.handleIPN(callbackData);
    return {
      RspCode: result.success ? '00' : '99',
      Message: result.message,
    };
  }

  @Get('vnpay/return')
  @Public()
  @ApiOperation({ summary: 'VNPay return callback' })
  @ApiResponse({ status: 200, description: 'Return processed' })
  async handleVNPayReturn(@Query() callbackData: any) {
    const result = await this.vnpayService.handleCallback(callbackData);
    return {
      success: result.success,
      message: result.message,
      bookingId: result.bookingId,
      amount: result.amount,
    };
  }
}
