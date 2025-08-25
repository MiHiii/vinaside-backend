import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Request,
  BadRequestException,
  UseGuards,
  Res,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { VNPayService } from './services/vnpay.service';
import { PaymentFactory } from './services/payment.factory';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateCancellationDetailsDto } from './dto/update-cancellation-details.dto';
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
import { StaffFiltered } from '../../decorators/staff-filtered.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PropertyStaffGuard } from '../../common/guards/property-staff.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { Roles } from 'src/decorators/roles.decorator';
import { Response } from 'express';
import { BookingExportService } from './services/booking-export.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { StaffCreateBookingDto } from './dto/staff-create-booking.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CalendarResponseDto } from './dto/calendar-response.dto';
import { VNPayCallbackDto } from './dto/vnpay-payment.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

interface VNPayReturnQueryParams {
  vnp_TmnCode?: string;
  vnp_Amount?: string;
  vnp_BankCode?: string;
  vnp_OrderInfo?: string;
  vnp_TxnRef?: string;
  vnp_ResponseCode?: string;
  vnp_TransactionNo?: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate?: string;
  vnp_SecureHash?: string;
  vnp_Command?: string;
  vnp_Version?: string;
  vnp_CurrCode?: string;
  vnp_Locale?: string;
  vnp_CreateDate?: string;
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
    private readonly bookingExportService: BookingExportService,
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
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({
    summary:
      'Lấy danh sách tất cả bookings (Admin: tất cả, Staff: chỉ assigned properties)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách bookings' })
  @ResponseMessage('Lấy danh sách bookings thành công')
  findAll(@Query() queryDto: QueryBookingDto, @Request() req: RequestWithUser) {
    return this.bookingService.findAll(queryDto, req.user, req);
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

  @Get('my-bookings-as-staff')
  @Roles('staff', 'admin')
  @RequirePermission('booking.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({
    summary: 'Lấy booking staff quản lý (Admin: tất cả, Staff: chỉ assigned)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách booking của staff' })
  @ResponseMessage('Lấy danh sách booking staff thành công')
  findMyBookingsAsStaff(
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findMyBookingsAsStaff(req.user, queryDto, req);
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

  @Get('check-booking-conflict/:listingId')
  @ApiOperation({
    summary:
      'Kiểm tra xem có booking nào khác đã thanh toán cho cùng khoảng thời gian không',
  })
  @ApiResponse({ status: 200, description: 'Kết quả kiểm tra conflict' })
  @ResponseMessage('Kiểm tra conflict thành công')
  checkBookingConflict(
    @Param('listingId') listingId: string,
    @Query('checkInDate') checkInDate: string,
    @Query('checkOutDate') checkOutDate: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    return this.bookingService.checkBookingConflictForDates(
      listingId,
      checkInDate,
      checkOutDate,
      excludeBookingId,
    );
  }

  // =================== EXPORT ENDPOINTS ===================
  @Get('export/csv')
  @RequirePermission('booking.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({ summary: 'Export danh sách booking ra CSV (stream)' })
  @ApiResponse({ status: 200, description: 'CSV stream' })
  async exportCsv(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('propertyId') propertyId?: string,
    @Query('listingId') listingId?: string,
  ) {
    await this.bookingExportService.streamCsv(res, {
      from,
      to,
      status,
      paymentStatus,
      propertyId,
      listingId,
    });
  }

  @Get('property/:propertyId/:id')
  @Roles('guest', 'staff', 'admin')
  @RequirePermission('booking.view')
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
      updateBookingDto as Record<string, unknown> & {
        selected_services?: Array<{ serviceId: string; quantity: number }>;
      },
      req.user as any as JwtPayload,
    );
  }

  @Patch('property/:propertyId/:id/cancel')
  @RequirePermission('booking.cancel')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Hủy booking (Admin/Staff)' })
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
    return this.bookingService.remove(id);
  }

  @Patch('property/:propertyId/:id/confirm')
  @RequirePermission('booking.confirm')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({
    summary: 'Cập nhật trạng thái booking (confirm/reject/complete)',
  })
  @ApiResponse({ status: 200, description: 'Booking được cập nhật thành công' })
  @ResponseMessage('Cập nhật trạng thái booking thành công')
  confirm(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }

    return this.bookingService.updateStatus(
      id,
      updateBookingStatusDto.status,
      req.user as any as JwtPayload,
    );
  }

  @Patch('my-bookings/:id')
  @Roles('guest')
  @ApiOperation({ summary: 'Cập nhật booking của tôi (Guest)' })
  @ApiResponse({ status: 200, description: 'Booking được cập nhật thành công' })
  @ResponseMessage('Cập nhật booking thành công')
  async updateMyBooking(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.bookingService.update(
      id,
      updateBookingDto as Record<string, unknown> & {
        selected_services?: Array<{ serviceId: string; quantity: number }>;
      },
      req.user as any as JwtPayload,
    );
  }

  @Patch('my-bookings/:id/cancel')
  @Roles('guest')
  @ApiOperation({ summary: 'Hủy booking của tôi (Guest)' })
  @ApiResponse({ status: 200, description: 'Booking được hủy thành công' })
  @ResponseMessage('Hủy booking thành công')
  async cancelBookingPublic(
    @Param('id') id: string,
    @Body() cancellationDetails: UpdateCancellationDetailsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.cancelBookingPublic(
      id,
      req.user._id,
      cancellationDetails,
    );
  }

  @Patch('admin/:propertyId/:id/cancel')
  @Roles('staff', 'admin')
  @RequirePropertyStaff({
    propertyIdSource: 'param',
    propertyIdParam: 'propertyId',
  })
  @RequirePermission('booking.cancel')
  @ApiOperation({ summary: 'Admin/Staff hủy booking trực tiếp' })
  @ApiParam({ name: 'propertyId', description: 'ID của property' })
  @ApiParam({ name: 'id', description: 'ID của booking' })
  @ApiResponse({ status: 200, description: 'Booking được hủy thành công' })
  @ResponseMessage('Hủy booking thành công')
  async cancelBookingAsAdmin(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() cancellationDetails: UpdateCancellationDetailsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.cancelBookingAsAdmin(
      id,
      req.user,
      cancellationDetails,
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
      paymentType: createPaymentDto.paymentType, // truyền paymentType xuống service
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

  @Post(':id/payment/remaining')
  @Roles('guest')
  @ApiOperation({
    summary: 'Tạo payment URL cho phần còn lại (remaining payment)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment URL cho phần còn lại được tạo thành công',
    type: PaymentResponseDto,
  })
  @ResponseMessage('Tạo payment URL phần còn lại thành công')
  async createRemainingPayment(
    @Param('id') bookingId: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: RequestWithUser,
  ): Promise<PaymentResponseDto> {
    createPaymentDto.bookingId = bookingId;
    const result = await this.bookingService.createRemainingPayment(
      bookingId,
      createPaymentDto,
      req.user as any as JwtPayload,
    );
    return result;
  }

  @Post(':propertyId/:id/payment/remaining/staff')
  @RequirePermission('booking.update')
  @ApiOperation({
    summary: 'Nhân viên thanh toán số tiền còn lại cho guest',
  })
  @ApiResponse({
    status: 200,
    description: 'Thanh toán số tiền còn lại thành công',
    type: PaymentResponseDto,
  })
  @ResponseMessage('Thanh toán số tiền còn lại thành công')
  async createStaffRemainingPayment(
    @Param('propertyId') propertyId: string,
    @Param('id') bookingId: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: RequestWithUser,
  ): Promise<PaymentResponseDto> {
    createPaymentDto.bookingId = bookingId;
    return await this.bookingService.createStaffRemainingPayment(
      propertyId,
      bookingId,
      createPaymentDto,
      req.user as any as JwtPayload,
    );
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
    return await this.bookingService.getPaymentStatus(bookingId);
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
  async getOverviewStatistics(
    @Query() query: BookingStatisticsQueryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.getOverviewStatistics(query, req.user);
  }

  // =================== VNPAY CALLBACK ENDPOINTS ===================

  @Post('vnpay/ipn')
  @Public()
  @ApiOperation({ summary: 'VNPay IPN callback' })
  @ApiResponse({ status: 200, description: 'IPN processed' })
  async handleVNPayIPN(@Body() callbackData: VNPayCallbackDto) {
    const result = await this.vnpayService.handleIPN(callbackData);
    return {
      RspCode: result.success ? '00' : '99',
      Message: result.message,
    };
  }

  @Get('vnpay/return')
  @Public()
  @ApiOperation({ summary: 'Handle VNPay return callback' })
  @ApiResponse({
    status: 200,
    description: 'VNPay return handled successfully',
  })
  @ResponseMessage('VNPay return handled successfully')
  async handleVNPayReturn(@Query() queryParams: VNPayReturnQueryParams) {
    console.log('[DEBUG] VNPay Return called with params:', queryParams);

    // Validate required fields
    const requiredFields = [
      'vnp_TmnCode',
      'vnp_Amount',
      'vnp_BankCode',
      'vnp_OrderInfo',
      'vnp_TxnRef',
      'vnp_ResponseCode',
      'vnp_TransactionNo',
      'vnp_BankTranNo',
      'vnp_CardType',
      'vnp_PayDate',
      'vnp_SecureHash',
    ];

    const missingFields = requiredFields.filter(
      (field) => !queryParams[field as keyof VNPayReturnQueryParams],
    );

    if (missingFields.length > 0) {
      console.log('[DEBUG] Missing required fields:', missingFields);

      // Nếu có vnp_TxnRef, cập nhật trạng thái booking thành FAILED
      if (queryParams.vnp_TxnRef) {
        try {
          console.log(
            '[DEBUG] User cancelled payment, updating status to FAILED',
          );

          const result = await this.vnpayService.handleUserCancellation(
            queryParams.vnp_TxnRef,
          );

          return {
            success: result.success,
            message: result.message,
            bookingId: result.bookingId,
            amount: result.amount,
          };
        } catch (error) {
          console.error('[DEBUG] Error updating booking status:', error);
        }
      }

      return {
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        bookingId: '',
        amount: 0,
      };
    }

    // Create a callback data object with only the fields that VNPay actually sends
    const callbackData: VNPayCallbackDto = {
      vnp_TmnCode: queryParams.vnp_TmnCode!,
      vnp_Amount: queryParams.vnp_Amount!,
      vnp_BankCode: queryParams.vnp_BankCode!,
      vnp_OrderInfo: queryParams.vnp_OrderInfo!,
      vnp_TxnRef: queryParams.vnp_TxnRef!,
      vnp_ResponseCode: queryParams.vnp_ResponseCode!,
      vnp_TransactionNo: queryParams.vnp_TransactionNo!,
      vnp_BankTranNo: queryParams.vnp_BankTranNo!,
      vnp_CardType: queryParams.vnp_CardType!,
      vnp_PayDate: queryParams.vnp_PayDate!,
      vnp_SecureHash: queryParams.vnp_SecureHash!,
      // Optional fields - only include if they exist
      ...(queryParams.vnp_Command && { vnp_Command: queryParams.vnp_Command }),
      ...(queryParams.vnp_Version && { vnp_Version: queryParams.vnp_Version }),
      ...(queryParams.vnp_CurrCode && {
        vnp_CurrCode: queryParams.vnp_CurrCode,
      }),
      ...(queryParams.vnp_Locale && { vnp_Locale: queryParams.vnp_Locale }),
      ...(queryParams.vnp_CreateDate && {
        vnp_CreateDate: queryParams.vnp_CreateDate,
      }),
    };

    console.log(
      '[DEBUG] Calling vnpayService.handleCallback with:',
      callbackData,
    );

    const result = await this.vnpayService.handleCallback(callbackData);

    console.log('[DEBUG] VNPay callback result:', result);

    return {
      success: result.success,
      message: result.message,
      bookingId: result.bookingId,
      amount: result.amount,
    };
  }

  // =================== NOTE & ADDITIONAL COST ENDPOINTS ===================

  @Patch(':propertyId/:id/note')
  @RequirePermission('booking.update')
  @ApiOperation({ summary: 'Cập nhật ghi chú cho booking' })
  @ApiResponse({ status: 200, description: 'Ghi chú được cập nhật thành công' })
  @ResponseMessage('Cập nhật ghi chú thành công')
  async updateNote(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() body: { note: string },
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.updateNote(propertyId, id, body.note, req.user);
  }

  @Patch(':propertyId/:id/additional-cost')
  @RequirePermission('booking.update')
  @ApiOperation({ summary: 'Cập nhật chi phí phát sinh cho booking' })
  @ApiResponse({
    status: 200,
    description: 'Chi phí phát sinh được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật chi phí phát sinh thành công')
  async updateAdditionalCost(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() body: { additionalCost: number; additionalCostReason?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.updateAdditionalCost(
      propertyId,
      id,
      body.additionalCost,
      body.additionalCostReason,
      req.user,
    );
  }

  // =================== CANCELLATION DETAILS ENDPOINTS ===================

  @Patch(':propertyId/:id/cancellation-details')
  @RequirePermission('booking.update')
  @ApiOperation({ summary: 'Cập nhật thông tin chi tiết hủy phòng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin hủy phòng được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật thông tin hủy phòng thành công')
  async updateCancellationDetails(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() cancellationDetails: UpdateCancellationDetailsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.updateCancellationDetails(
      propertyId,
      id,
      cancellationDetails,
      req.user,
    );
  }

  @Get(':propertyId/:id/cancellation-details')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết hủy phòng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin hủy phòng được trả về thành công',
  })
  @ResponseMessage('Lấy thông tin hủy phòng thành công')
  async getCancellationDetails(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
  ): Promise<any> {
    return this.bookingService.getCancellationDetails(propertyId, id);
  }

  // =================== STAFF BOOKING ENDPOINTS ===================

  @Post('staff/create')
  @RequirePermission('booking.create')
  @ApiOperation({
    summary: 'Tạo booking cho nhân viên (có thể tích hợp VNPay URL)',
    description:
      'Tạo booking và tùy chọn tạo URL thanh toán VNPay ngay lập tức',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking được tạo thành công (có thể kèm payment URL)',
    // type: StaffBookingResponseDto,
  })
  @ResponseMessage('Tạo booking thành công')
  async createStaffBooking(
    @Body() createBookingDto: StaffCreateBookingDto,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    // StaffBookingResponseDto
    console.log('=== CONTROLLER PAYMENT TYPE CHECK ===');
    console.log('payment_type:', createBookingDto.payment_type);
    console.log('payment_status:', createBookingDto.payment_status);
    console.log('create_payment_url:', createBookingDto.create_payment_url);

    return await this.bookingService.createStaffBooking(
      createBookingDto,
      req.user,
    );
  }

  // =================== CALENDAR ENDPOINTS ===================

  @Get('calendar')
  @RequirePermission('booking.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({ summary: 'Lấy dữ liệu calendar theo ngày' })
  @ApiResponse({
    status: 200,
    description: 'Dữ liệu calendar được trả về thành công',
    type: CalendarResponseDto,
  })
  @ResponseMessage('Lấy dữ liệu calendar thành công')
  async getCalendarData(
    @Query() queryDto: CalendarQueryDto,
    @Request() req: RequestWithUser,
  ): Promise<CalendarResponseDto> {
    return await this.bookingService.getCalendarData(queryDto, req.user, req);
  }

  @Get('calendar/day/:date')
  @RequirePermission('booking.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({ summary: 'Lấy thông tin booking chi tiết cho một ngày' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin booking theo ngày được trả về thành công',
  })
  @ResponseMessage('Lấy thông tin booking theo ngày thành công')
  async getDayBookings(
    @Param('date') date: string,
    @Request() req: RequestWithUser,
    @Query('propertyId') propertyId?: string,
    @Query('listingId') listingId?: string,
  ) {
    return await this.bookingService.getDayBookings(
      date,
      propertyId,
      listingId,
      req.user,
      req,
    );
  }

  @Post(':id/payment/staff')
  @RequirePermission('booking.update')
  @ApiOperation({
    summary: 'Tạo payment URL cho staff/admin (hỗ trợ VNPay & MoMo)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment URL được tạo thành công',
    type: PaymentResponseDto,
  })
  @ResponseMessage('Tạo payment URL thành công')
  async createPaymentForStaff(
    @Param('id') bookingId: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: RequestWithUser,
  ): Promise<PaymentResponseDto> {
    // Yêu cầu propertyId trong request body
    if (!createPaymentDto.propertyId) {
      throw new BadRequestException('propertyId là bắt buộc cho staff payment');
    }

    // Sử dụng logic đã có sẵn
    return await this.bookingService.createStaffRemainingPayment(
      createPaymentDto.propertyId,
      bookingId,
      createPaymentDto,
      req.user as any as JwtPayload,
    );
  }
}
