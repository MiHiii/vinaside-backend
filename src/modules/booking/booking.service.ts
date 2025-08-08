/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types, SortOrder } from 'mongoose';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from './schemas/booking.schema';
import { PaymentMethod } from '../transactions/schemas/transaction.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { StaffCreateBookingDto } from './dto/staff-create-booking.dto';
import { parseSortString } from '../../utils/common.util';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { BookingRepo } from './booking.repo';
import { ListingService } from '../listing/listing.service';
import { PropertyService } from '../properties/services/property.service';
import { MailService } from '../mail/mail.service';
import { EmailQueueService } from '../mail/mail.queue';
import { VoucherService } from '../vouchers/voucher.service';
import { ServicesService } from '../services/services.service';
import { ReservationData } from '../mail/interfaces/reservation-data.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PropertyStaffAssignmentService } from '../property-staff-assignment/property-staff-assignment.service';

import { AssignmentStatus } from '../property-staff-assignment/schemas/property-staff-assignment.schema';
import {
  NotificationType,
  RecipientType,
  NotificationStatus,
  SentMethod,
} from '../notifications/schemas/notification.schema';
import { forwardRef, Inject } from '@nestjs/common';
import { ReviewsService } from '../reviews/reviews.service';
import {
  BookingOverviewStatistics,
  BookingStatusStatistics,
  BookingFinancialStatistics,
  BookingCustomerStatistics,
  BookingTimelineStatistics,
  BookingChartDataPoint,
} from './dto/booking-statistics.dto';
import {
  getDefaultDateRange,
  determineGroupBy,
  getGroupFormat,
  generateLabels,
} from '../../utils/date.util';
import { CancelPolicy } from '../listing/schemas/listing.schema';
// import { Listing } from '../listing/schemas/listing.schema';
import { PaymentFactory } from './services/payment.factory';
import { PaymentResponseDto, CreatePaymentDto } from './dto/payment.dto';
import { TransactionsService } from '../transactions/services/transactions.service';
import {
  applyStaffFilter,
  RequestWithStaffFilter,
} from '../../utils/staff-filter.util';
import { PaymentStatusDto } from './dto/payment.dto';
import { CalendarQueryDto, CalendarViewType } from './dto/calendar-query.dto';
import {
  CalendarResponseDto,
  CalendarDayDto,
  CalendarBookingDto,
} from './dto/calendar-response.dto';
export interface PaginatedBookings {
  data: BookingResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  // Cache để tránh gửi duplicate admin notifications trong cùng 1 request
  private adminNotificationCache = new Map<string, Set<string>>();

  constructor(
    private readonly bookingRepo: BookingRepo,
    private readonly listingService: ListingService,
    private readonly propertyService: PropertyService,
    private readonly mailService: MailService,
    private readonly emailQueueService: EmailQueueService,
    private readonly voucherService: VoucherService,
    private readonly servicesService: ServicesService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => ReviewsService))
    private readonly reviewsService: ReviewsService,
    private readonly paymentFactory: PaymentFactory,
    private readonly transactionsService: TransactionsService,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Transform booking data thành response format
   */
  private transformBookingToResponse(booking: any): BookingResponseDto {
    // Handle guestId: can be ObjectId or populated object
    let guestId: string = '';
    let guest_name: string | undefined = undefined;
    let guest_email: string | undefined = undefined;
    let guest_phone: string | undefined = undefined;
    if (booking.guestId) {
      if (typeof booking.guestId === 'object' && booking.guestId._id) {
        guestId = booking.guestId._id.toString();
        guest_name = booking.guestId.name;
        guest_email = booking.guestId.email;
        guest_phone = booking.guestId.phone;
      } else {
        guestId = booking.guestId.toString();
        guest_name = booking.guest_name;
        guest_email = booking.guest_email;
        guest_phone = booking.guest_phone;
      }
    }
    return {
      _id: booking._id ? booking._id.toString() : null,
      propertyId:
        booking.propertyId && typeof booking.propertyId === 'object'
          ? {
              _id: booking.propertyId._id?.toString?.() || '',
              name: booking.propertyId.name || '',
              location: booking.propertyId.location || undefined,
            }
          : booking.propertyId
            ? booking.propertyId.toString()
            : '',
      listingId: booking.listingId
        ? typeof booking.listingId === 'object' && booking.listingId._id
          ? {
              _id: booking.listingId._id.toString(),
              title: booking.listingId.title,
              images: booking.listingId.images,
              address: booking.listingId.address,
              price_per_night: booking.listingId.price_per_night,
              // Không cần cancel_policy ở đây
            }
          : booking.listingId.toString()
        : null,
      cancel_policy:
        booking.listingId &&
        typeof booking.listingId === 'object' &&
        'cancel_policy' in booking.listingId
          ? booking.listingId.cancel_policy
          : undefined,
      guestId,
      checkInDate: booking.checkInDate,
      check_out_date: booking.check_out_date,
      guests: booking.guests,
      infants: booking.infants,
      nights: booking.nights,
      price_per_night: booking.price_per_night,
      total_price: booking.total_price,
      selected_services: booking.selected_services?.map((service: any) => ({
        service_id: service.service_id ? service.service_id.toString() : null,
        service_name: service.service_name,
        service_price: service.service_price,
        quantity: service.quantity,
        total_price: service.total_price,
      })),
      services_total_amount: booking.services_total_amount,
      subtotal_amount: booking.subtotal_amount,
      voucher_id: booking.voucher_id
        ? booking.voucher_id.toString()
        : undefined,
      voucher_code: booking.voucher_code,
      voucher_discount_amount: booking.voucher_discount_amount,
      voucher_discount_percent: booking.voucher_discount_percent,
      discount_amount: booking.discount_amount,
      amount_after_discount: booking.amount_after_discount,
      service_fee: booking.service_fee,
      tax_amount: booking.tax_amount,
      final_amount: booking.final_amount,
      commissionRate: booking.commissionRate,
      finalPayoutAmount: booking.finalPayoutAmount,
      status: booking.status,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method,
      vnpay_order_id: booking.vnpay_order_id,
      momo_order_id: booking.momo_order_id,
      guest_name,
      guest_email,
      guest_phone,
      special_requests: booking.special_requests,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
      payment_id: booking.payment_id,
      vnpay_pay_date: booking.vnpay_pay_date,
      deposit_paid_amount: booking.deposit_paid_amount,
      outstanding_amount:
        (booking.final_amount || 0) - (booking.deposit_paid_amount || 0),

      note: booking.note,
      additionalCost: booking.additionalCost,
      additionalCostReason: booking.additionalCostReason,
      cancellationDetails: booking.cancellationDetails,
      cancellationDetailsUpdatedAt: booking.cancellationDetailsUpdatedAt,
      cancellationDetailsUpdatedBy: booking.cancellationDetailsUpdatedBy
        ? booking.cancellationDetailsUpdatedBy.toString()
        : undefined,
    };
  }

  /**
   * Tạo một booking mới và trả về dữ liệu định dạng
   */
  async create(
    createBookingDto: CreateBookingDto,
    user: JwtPayload,
  ): Promise<BookingResponseDto> {
    const {
      listingId,
      checkInDate,
      checkOutDate,
      guests,
      voucherCode,
      services,
    } = createBookingDto;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Không cho phép đặt phòng cho ngày trong quá khứ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      throw new BadRequestException(
        'Không thể đặt phòng cho ngày trong quá khứ',
      );
    }

    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng');
    }

    // Lấy thông tin listing (đã tự động check trạng thái active)
    const listing = await this.listingService.findOne(listingId);
    if (!listing) {
      throw new NotFoundException(
        `Không tìm thấy listing với ID ${listingId} hoặc listing không active`,
      );
    }

    const isAvailable = await this.checkAvailability(
      listingId,
      checkInDate,
      checkOutDate,
    );
    if (!isAvailable.available) {
      throw new BadRequestException(
        'Listing không có sẵn cho các ngày đã chọn',
      );
    }

    if (guests > listing.max_guests) {
      throw new BadRequestException(
        `Số khách vượt quá giới hạn cho phép (${listing.max_guests})`,
      );
    }

    interface PopulatedListingForBooking {
      _id: Types.ObjectId;
      propertyId: {
        _id: Types.ObjectId;
        name?: string;
      };
      price_per_night: number;
      title?: string;
      images: string[]; // Thêm dòng này để fix lỗi
    }
    const populatedListing = listing as unknown as PopulatedListingForBooking;
    const propertyId = populatedListing.propertyId._id;

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24),
    );

    // ✅ THÊM VÀO ĐÂY: Tính weekend surcharge
    let weekendSurcharge = 0;
    if (listing.has_weekend_surcharge) {
      const weekendDays = this.calculateWeekendDays(checkIn, checkOut);
      const surchargePercent = listing.weekend_surcharge_percent || 0;
      weekendSurcharge =
        (populatedListing.price_per_night * weekendDays * surchargePercent) /
        100;
    }

    // Tính toán giá phòng cơ bản + weekend surcharge
    const totalPrice =
      populatedListing.price_per_night * nights + weekendSurcharge;

    // Xử lý services
    let servicesTotalAmount = 0;
    const selectedServices: Array<{
      service_id: Types.ObjectId;
      service_name: string;
      service_price: number;
      quantity: number;
      total_price: number;
    }> = [];

    if (services && services.length > 0) {
      for (const serviceDto of services) {
        const service = await this.servicesService.findOne(
          serviceDto.serviceId,
        );
        if (!service) {
          throw new NotFoundException(
            `Không tìm thấy service với ID ${serviceDto.serviceId}`,
          );
        }

        const serviceTotalPrice = service.default_price * serviceDto.quantity;
        servicesTotalAmount += serviceTotalPrice;

        selectedServices.push({
          service_id: new Types.ObjectId(serviceDto.serviceId),
          service_name: service.name,
          service_price: service.default_price,
          quantity: serviceDto.quantity,
          total_price: serviceTotalPrice,
        });
      }
    }

    // Tính subtotal (giá phòng + services)
    const subtotalAmount = totalPrice + servicesTotalAmount;

    // Xử lý voucher
    let voucherId: Types.ObjectId | null = null;
    let voucherCodeValue: string | null = null;
    let voucherDiscountAmount = 0;
    let voucherDiscountPercent = 0;
    let discountAmount = 0;
    let amountAfterDiscount = subtotalAmount;

    if (voucherCode) {
      try {
        const voucherValidation = await this.voucherService.validateVoucher(
          voucherCode,
          subtotalAmount,
          listingId,
          propertyId.toString(),
          user._id,
        );

        // Sửa lỗi: Luôn kiểm tra lại trạng thái hoạt động và các điều kiện của voucher tại thời điểm tạo booking
        if (
          !voucherValidation.valid ||
          !voucherValidation.voucher ||
          !voucherValidation.voucher.is_active
        ) {
          throw new BadRequestException(
            voucherValidation.message ||
              'Voucher không hợp lệ hoặc đã bị vô hiệu hóa',
          );
        }

        voucherId = voucherValidation.voucher._id as Types.ObjectId;
        voucherCodeValue = voucherValidation.voucher.code;
        voucherDiscountAmount = voucherValidation.discount_amount || 0;
        voucherDiscountPercent = voucherValidation.voucher.discount_percent;
        discountAmount = voucherDiscountAmount;
        amountAfterDiscount = subtotalAmount - discountAmount;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('Voucher không hợp lệ hoặc đã hết hạn');
      }
    }

    // Tính toán phí và thuế
    const serviceFee = amountAfterDiscount * 0.1; // 10% của amount_after_discount
    const taxAmount = amountAfterDiscount * 0.08; // 8% của amount_after_discount
    let finalAmount = amountAfterDiscount + serviceFee + taxAmount; // amount_after_discount + service_fee + tax_amount
    finalAmount = Math.round(finalAmount); // Làm tròn số tiền cuối cùng
    const commissionRate = 0.1;
    const finalPayoutAmount = amountAfterDiscount * (1 - commissionRate);

    // Gán deposit_percent mặc định theo cancel_policy
    let depositPercent = 0.5;
    if (listing.cancel_policy === CancelPolicy.STRICT) {
      depositPercent = 1;
    }

    const bookingData = {
      propertyId,
      listingId: new Types.ObjectId(listingId),
      guestId: new Types.ObjectId(user._id),
      checkInDate: checkIn,
      check_out_date: checkOut,
      guests: guests,
      infants: createBookingDto.infants || 0,
      special_requests: createBookingDto.specialRequests || '',
      nights,
      price_per_night: populatedListing.price_per_night,
      total_price: totalPrice,
      services_total_amount: servicesTotalAmount,
      subtotal_amount: subtotalAmount,
      voucher_id: voucherId,
      voucher_code: voucherCodeValue,
      voucher_discount_amount: voucherDiscountAmount,
      voucher_discount_percent: voucherDiscountPercent,
      discount_amount: discountAmount,
      amount_after_discount: amountAfterDiscount,
      selected_services: selectedServices,
      service_fee: serviceFee,
      tax_amount: taxAmount,
      final_amount: finalAmount,
      commissionRate,
      finalPayoutAmount,
      guest_name: user.name,
      guest_email: user.email,
      guest_phone: '',
      deposit_percent: depositPercent,
      deposit_paid: false,
    };

    // BaseRepo.create expects a generic object, not a DTO with methods
    const createdBooking = await this.bookingRepo.create(bookingData, user._id);

    // Sử dụng voucher nếu có
    if (voucherId && voucherCodeValue) {
      try {
        await this.voucherService.useVoucher(
          voucherId.toString(),
          user._id,
          (createdBooking._id as Types.ObjectId).toString(),
          voucherDiscountAmount,
          subtotalAmount,
        );
      } catch (error) {
        this.logger.error(
          `Failed to use voucher ${voucherCodeValue} for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
          error,
        );
        // Không throw error để không ảnh hưởng đến việc tạo booking
      }
    }

    // Gửi email thông báo cho khách hàng
    const guestReservationData: ReservationData = {
      id: (createdBooking._id as Types.ObjectId).toString(),
      userName: user.name || user.email,
      propertyName:
        populatedListing.propertyId.name || populatedListing.title || 'Tài sản',
      checkIn: checkIn,
      checkOut: checkOut,
      roomInfo: {
        name: populatedListing.title || 'Phòng',
        address: '', // Có thể lấy từ property location
      },
      totalPrice: finalAmount,
    };

    // Gửi email xác nhận cho khách
    await this.emailQueueService.addReservationConfirmation({
      email: user.email,
      reservationData: guestReservationData,
    });

    // Tạo thông báo cho khách hàng
    try {
      // Lấy avatar_url của phòng (listing)
      const avatar_url =
        Array.isArray(populatedListing.images) &&
        populatedListing.images.length > 0
          ? populatedListing.images[0]
          : '';
      const roomName =
        populatedListing.title || populatedListing.propertyId.name || 'Căn hộ';
      const bookingCode = (createdBooking._id as Types.ObjectId)
        .toString()
        .slice(-8);

      await this.notificationsService.create({
        user_id: user._id,
        recipient_type: RecipientType.GUEST,
        title: '🎉 Đặt phòng thành công',
        message: `Chúc mừng! Bạn đã đặt phòng thành công tại ${roomName}. Tổng thanh toán: ${finalAmount.toLocaleString('vi-VN')} VNĐ. Mã đặt phòng: ${bookingCode.toUpperCase()}`,
        type: NotificationType.BOOKING,
        status: NotificationStatus.SENT,
        sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
        avatar_url, // truyền avatar_url
        metadata: {
          bookingId: (createdBooking._id as Types.ObjectId).toString(),
          propertyId: propertyId.toString(),
          listingId: listing._id?.toString(),
          amount: finalAmount,
          bookingStatus: BookingStatus.PENDING,
          roomName: roomName,
          propertyName: populatedListing.propertyId.name,
          listingTitle: populatedListing.title,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create guest notification for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
    }

    // Lấy staff emails từ property và gửi thông báo
    try {
      const staffEmails = await this.mailService.getStaffEmails(
        propertyId.toString(),
      );

      if (staffEmails.length > 0) {
        const staffReservationData: ReservationData = {
          ...guestReservationData,
          staffEmails,
        };

        // Gửi email thông báo cho tất cả staff
        await this.emailQueueService.addStaffNotification({
          staffEmails,
          reservationData: staffReservationData,
        });

        // Tạo thông báo cho staff
        await this.createStaffNotifications(
          propertyId.toString(),
          createdBooking,
          populatedListing,
          finalAmount,
        );
      } else {
        this.logger.warn(
          `No staff found for property ${propertyId.toString()} - no staff notification sent for booking ${(createdBooking._id as Types.ObjectId).toString()}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send staff notifications for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
      // Không throw error để không ảnh hưởng đến việc tạo booking
    }

    // Tạo thông báo cho admin (luôn tạo, không phụ thuộc vào staff)
    try {
      await this.createAdminNewBookingNotification(
        createdBooking,
        populatedListing,
        finalAmount,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin notifications for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
      // Không throw error để không ảnh hưởng đến việc tạo booking
    }

    return this.transformBookingToResponse(createdBooking);
  }

  /**
   * Tìm một booking theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findById(id, {
      populate: [
        { path: 'propertyId', select: '_id name address location' },
        {
          path: 'listingId',
          select: 'title address images price_per_night cancel_policy',
        },
        { path: 'guestId', select: 'name avatar email phone' },
        { path: 'voucher_id', select: 'code discount_percent' },
      ],
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking với ID ${id}.`);
    }

    return this.transformBookingToResponse(booking);
  }

  /**
   * Cập nhật thông tin booking và trả về dữ liệu định dạng
   */
  async update(
    id: string,
    updateBookingDto: Record<string, unknown> & {
      selected_services?: Array<{ serviceId: string; quantity: number }>;
    }, // mở rộng để nhận selected_services
    user: JwtPayload,
  ): Promise<BookingResponseDto> {
    // 1. Lấy booking hiện tại
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');

    // Store original status to detect changes
    const originalStatus = booking.status;

    // 2. Check quyền
    const isGuest = user.role === 'guest';
    if (isGuest) {
      if (
        booking.guestId &&
        booking.guestId.toString() !== user._id.toString()
      ) {
        throw new ForbiddenException(
          'Bạn chỉ được sửa booking của chính mình.',
        );
      }
      if (['cancelled', 'completed', 'rejected'].includes(booking.status)) {
        throw new BadRequestException(
          'Không thể sửa booking đã cancelled/completed/rejected.',
        );
      }
    }
    // Staff đã được check quyền ở controller

    // 4. Nếu có selected_services mới
    if (updateBookingDto.selected_services) {
      // Chuyển đổi từ BookingServiceDto sang format cần thiết
      const processedServices: any[] = [];
      let totalServicesAmount = 0;

      for (const serviceDto of updateBookingDto.selected_services) {
        // Lấy thông tin service từ database
        const service = await this.servicesService.findOne(
          serviceDto.serviceId,
        );
        if (!service) {
          throw new BadRequestException(
            `Không tìm thấy dịch vụ với ID: ${serviceDto.serviceId}`,
          );
        }

        const totalPrice = service.default_price * serviceDto.quantity;
        totalServicesAmount += totalPrice;

        processedServices.push({
          service_id: new Types.ObjectId(serviceDto.serviceId),
          service_name: service.name,
          service_price: service.default_price,
          quantity: serviceDto.quantity,
          total_price: totalPrice,
        });
      }

      // a. Kiểm tra và validate dịch vụ cũ (nếu có)
      const oldServices = booking.selected_services || [];
      if (oldServices.length > 0) {
        const oldMap = new Map<string, any>();
        oldServices.forEach((s) => oldMap.set(s.service_id.toString(), s));

        const newMap = new Map<string, any>();
        processedServices.forEach((s) =>
          newMap.set(s.service_id.toString(), s),
        );

        // Cho phép thay thế hoàn toàn danh sách dịch vụ
        // Chỉ validate nếu có dịch vụ cũ trong danh sách mới
        for (const oldId of oldMap.keys()) {
          if (newMap.has(oldId)) {
            // Nếu dịch vụ cũ vẫn có trong danh sách mới, không được giảm số lượng
            if (newMap.get(oldId).quantity < oldMap.get(oldId).quantity) {
              throw new BadRequestException(
                'Không được giảm số lượng dịch vụ đã có.',
              );
            }
          }
        }
      }

      // b. Tính tổng tiền dịch vụ cũ và mới
      const oldTotal = oldServices.reduce(
        (sum, s) => sum + (s.total_price || 0),
        0,
      );

      // Chỉ validate giảm tổng tiền nếu có dịch vụ cũ
      if (oldServices.length > 0 && totalServicesAmount < oldTotal) {
        throw new BadRequestException('Không được giảm tổng tiền dịch vụ.');
      }

      // c. Cộng phần chênh lệch vào final_amount
      const diff = totalServicesAmount - oldTotal;
      if (diff > 0) {
        updateBookingDto.final_amount = booking.final_amount + diff;
      } else {
        updateBookingDto.final_amount = booking.final_amount;
      }

      // d. Cập nhật lại services_total_amount và selected_services
      updateBookingDto.services_total_amount = totalServicesAmount;
      updateBookingDto.selected_services = processedServices;

      // e. Cập nhật payment_status nếu có thêm dịch vụ và booking đã PAID
      // Chỉ chuyển sang PARTIALLY_PAID nếu số tiền đã trả chưa đủ cho tổng tiền mới
      if (diff > 0 && booking.payment_status === PaymentStatus.PAID) {
        const newTotalAmount = booking.final_amount + diff;
        const paidAmount = booking.deposit_paid_amount || 0;
        if (paidAmount < newTotalAmount) {
          updateBookingDto.payment_status = PaymentStatus.PARTIALLY_PAID;
        }
        // Nếu đã trả đủ cho tổng tiền mới thì giữ nguyên PAID
      }
    }

    // Không động vào deposit_paid_amount
    delete updateBookingDto.deposit_paid_amount;

    // 5. Update booking
    const updated = await this.bookingRepo.updateById(
      id,
      updateBookingDto,
      user._id,
    );

    if (!updated)
      throw new NotFoundException(
        'Không tìm thấy booking hoặc không thể cập nhật.',
      );

    // Check if status changed and create notifications
    const newStatus = updated.status;
    if (originalStatus !== newStatus) {
      try {
        await this.createStatusChangeNotification(updated, newStatus);
      } catch (error) {
        this.logger.error(
          `[UPDATE] Failed to create status change notifications for booking ${id}:`,
          error,
        );
        // Don't throw - continue with response
      }
    }

    // 6. Trả về booking + outstanding_amount
    const result = this.transformBookingToResponse(updated);
    result.outstanding_amount =
      (result.final_amount || 0) - (updated.deposit_paid_amount || 0);
    return result;
  }

  /**
   * Xóa mềm booking và trả về dữ liệu định dạng
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const booking = await this.bookingRepo.findById(id);
    if (!booking)
      throw new NotFoundException('Không tìm thấy booking hoặc không thể xóa.');

    // Cập nhật trạng thái
    booking.status = BookingStatus.CANCELLED;
    if ((booking.deposit_paid_amount || 0) > 0) {
      booking.payment_status = PaymentStatus.REFUNDING;
    } else {
      booking.payment_status = PaymentStatus.UNPAID;
    }
    booking.cancelled_at = new Date();
    booking.cancellation_reason = 'Admin/staff cancelled';

    await booking.save();

    // Create status change notifications for guest, staff, and admin
    try {
      await this.createStatusChangeNotification(
        booking,
        BookingStatus.CANCELLED,
      );
    } catch (error) {
      this.logger.error('Failed to create status change notifications:', error);
    }

    return { success: true };
  }

  /**
   * Khôi phục booking đã xóa và trả về dữ liệu định dạng
   */
  async restore(id: string, user: JwtPayload): Promise<Booking> {
    const restored = await this.bookingRepo.restore(id, user._id);
    if (!restored)
      throw new NotFoundException(
        'Không tìm thấy booking hoặc không thể khôi phục.',
      );
    return restored;
  }

  /**
   * Cập nhật trạng thái booking và trả về dữ liệu định dạng
   */
  async updateStatus(id: string, status: BookingStatus, user: JwtPayload) {
    const booking = await this.changeStatus(id, status, user);

    // Nếu xác nhận hoàn thành thì chuyển sang completed
    if (status === BookingStatus.COMPLETED) {
      booking.status = BookingStatus.COMPLETED;
      await booking.save();
    }

    // Tạo thông báo khi trạng thái booking thay đổi
    await this.createStatusChangeNotification(booking, status);

    return { booking };
  }

  /**
   * Tìm danh sách theo bộ lọc và trả về dữ liệu định dạng
   */
  async findAll(
    queryDto: QueryBookingDto,
    user?: JwtPayload,
    request?: RequestWithStaffFilter,
  ): Promise<PaginatedBookings> {
    const { page = 1, limit = 10, sortBy, sortOrder, ...filters } = queryDto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<Booking> & {
      checkInDate?: { $gte?: Date; $lte?: Date };
    } = { isDeleted: filters.includeDeleted ?? false };

    if (filters.propertyId)
      query.propertyId = new Types.ObjectId(filters.propertyId);
    if (filters.listingId)
      query.listingId = new Types.ObjectId(filters.listingId);
    if (filters.guestId) query.guestId = new Types.ObjectId(filters.guestId);
    if (filters.status) query.status = filters.status;
    if (filters.paymentStatus) query.payment_status = filters.paymentStatus;
    if (filters.checkInFrom || filters.checkInTo) {
      query.checkInDate = {};
      if (filters.checkInFrom)
        (query.checkInDate as { $gte?: Date; $lte?: Date }).$gte = new Date(
          filters.checkInFrom,
        );
      if (filters.checkInTo)
        (query.checkInDate as { $gte?: Date; $lte?: Date }).$lte = new Date(
          filters.checkInTo,
        );
    }

    // Apply staff filtering using utility function
    const filteredQuery = applyStaffFilter(query, request, 'propertyId');

    const sort: Record<string, SortOrder> = {
      [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1,
    };

    const { data, total } = await this.bookingRepo.findAll(filteredQuery, {
      sort,
      skip,
      limit,
      populate: [
        { path: 'propertyId', select: '_id name location' },
        {
          path: 'listingId',
          select: 'title address images price_per_night cancel_policy',
        },
        { path: 'guestId', select: 'name avatar email phone' },
        { path: 'voucher_id', select: 'code discount_percent' },
      ],
    });

    return {
      data: data.map((booking) => this.transformBookingToResponse(booking)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  /**
   * Tìm danh sách booking của một guest
   */
  async findByGuest(guestId: string, queryDto: QueryBookingDto) {
    const result = await this.findBookingsByGuest(guestId, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      bookings: result.data.map((booking) =>
        this.transformBookingToResponse(booking),
      ),
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }
  /**
   * Tìm danh sách booking của một listing
   */
  async findByListing(listingId: string, queryDto: QueryBookingDto) {
    // Staff permission checking is now handled by @RequirePropertyStaff decorator
    // at controller level, so we can proceed directly to query

    const result = await this.findBookingsByListing(listingId, queryDto);
    const { page = 1, limit = 10 } = queryDto;

    return {
      bookings: result.data.map((booking) =>
        this.transformBookingToResponse(booking),
      ),
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Check xem có booking conflict không cho một listing và khoảng thời gian
   */
  async checkAvailability(
    listingId: string,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<{ available: boolean; message: string }> {
    // Kiểm tra listing có tồn tại và active không
    try {
      const listing = await this.listingService.findOne(listingId);
      if (!listing) {
        return {
          available: false,
          message: 'Listing không tồn tại hoặc không active.',
        };
      }
    } catch {
      return {
        available: false,
        message: 'Listing không tồn tại hoặc không active.',
      };
    }

    const isConflict = await this.bookingRepo.checkBookingConflict(
      listingId,
      new Date(checkInDate),
      new Date(checkOutDate),
    );

    return {
      available: !isConflict,
      message: isConflict
        ? 'Listing không có sẵn cho các ngày này.'
        : 'Listing có sẵn.',
    };
  }

  /**
   * Lấy các ngày đã được đặt cho một listing (cho Front-end calendar)
   */
  async getBookedDates(listingId: string) {
    const { data } = await this.bookingRepo.findAll({
      listingId: new Types.ObjectId(listingId),
      payment_status: { $in: ['paid', 'partially_paid'] },
      isDeleted: false,
    });

    const bookedDates: string[] = [];
    data.forEach((booking) => {
      const current = new Date(booking.checkInDate);
      const checkOut = new Date(booking.check_out_date);
      while (current < checkOut) {
        bookedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    return {
      bookedDates: [...new Set(bookedDates)].sort(),
    };
  }

  /**
   * Lấy tất cả bookings của staff hiện tại (tất cả bookings của properties mà staff được gán)
   */
  async findMyBookingsAsStaff(
    user: JwtPayload,
    queryDto: QueryBookingDto,
    request?: RequestWithStaffFilter,
  ) {
    if (!user || !user._id) {
      throw new BadRequestException('Thông tin người dùng không hợp lệ');
    }

    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeDeleted = false,
      ...filters
    } = queryDto;

    // Tạo base query
    const baseQuery: FilterQuery<Booking> = {
      isDeleted: includeDeleted,
    };

    // Thêm các bộ lọc khác
    if (filters.status) baseQuery.status = filters.status;
    if (filters.paymentStatus) baseQuery.payment_status = filters.paymentStatus;

    // Áp dụng staff filter nếu là staff user
    if (user.role === 'staff' && request?.staffPropertyIds) {
      if (request.staffPropertyIds.length === 0) {
        // Staff không được assign property nào, trả về empty result
        return {
          bookings: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      // Filter theo properties được assign
      baseQuery.propertyId = {
        $in: request.staffPropertyIds.map(
          (id: string) => new Types.ObjectId(id),
        ),
      };
    }

    const skip = (page - 1) * limit;
    const sort = parseSortString(`${sortBy}:${sortOrder}`);

    const result = await this.bookingRepo.findAll(baseQuery, {
      sort,
      skip,
      limit,
      populate: [
        {
          path: 'listingId',
          select: 'title address images price_per_night cancel_policy',
        },
        { path: 'guestId', select: 'name avatar email phone' },
        { path: 'propertyId', select: '_id name location' },
      ],
    });

    return {
      bookings: result.data.map((booking) =>
        this.transformBookingToResponse(booking),
      ),
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit) || 1,
      },
    };
  }

  /**
   * Lấy tất cả bookings của guest hiện tại (lịch sử đặt phòng)
   */
  findMyBookingsAsGuest(user: JwtPayload, queryDto: QueryBookingDto) {
    if (!user || !user._id) {
      throw new BadRequestException('Thông tin người dùng không hợp lệ');
    }

    // Guest chỉ xem được bookings mình đã đặt
    if (user.role !== 'admin' && user.role !== 'guest') {
      throw new ForbiddenException('Chỉ guest và admin mới có quyền này');
    }

    return this.findBookingsByGuest(user._id, queryDto).then((result) => {
      const { page = 1, limit = 10 } = queryDto;
      return {
        bookings: result.data.map((booking) =>
          this.transformBookingToResponse(booking),
        ),
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit) || 1,
        },
      };
    });
  }

  async cancelBookingPublic(
    id: string,
    guestId: string,
    cancellationDetails?: {
      accountName?: string;
      bankName?: string;
      accountNumber?: string;
      cancellationReason?: string;
      refundMethod?: string;
      refundNote?: string;
    },
  ) {
    // 1. Xác thực quyền
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }
    if (booking.guestId && booking.guestId.toString() !== guestId) {
      throw new ForbiddenException('Bạn không có quyền huỷ booking này');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking đã bị huỷ trước đó');
    }

    // 2. Cập nhật trạng thái
    booking.status = BookingStatus.CANCELLED;
    if ((booking.deposit_paid_amount || 0) > 0) {
      booking.payment_status = PaymentStatus.REFUNDING;
    } else {
      booking.payment_status = PaymentStatus.UNPAID;
    }
    booking.cancelled_at = new Date();

    // 3. Lưu thông tin hủy chi tiết nếu có
    if (cancellationDetails) {
      booking.cancellationDetails = {
        accountName: cancellationDetails.accountName,
        bankName: cancellationDetails.bankName,
        accountNumber: cancellationDetails.accountNumber,
        cancellationReason: cancellationDetails.cancellationReason,
        refundMethod: cancellationDetails.refundMethod,
        refundNote: cancellationDetails.refundNote,
      };
      booking.cancellationDetailsUpdatedAt = new Date();
      booking.cancellationDetailsUpdatedBy = new Types.ObjectId(guestId);
    } else {
      booking.cancellation_reason = 'Public user cancelled';
    }

    // 3. Tính toán hoàn tiền theo chính sách
    // Lấy thông tin listing để lấy cancel_policy (cho phép lấy listing ở bất kỳ trạng thái nào vì booking đã được tạo)
    const listing = await this.listingService.findOneForStaff(
      booking.listingId.toString(),
    );
    const cancel_policy = listing?.cancel_policy || CancelPolicy.FLEXIBLE;
    const now = new Date();
    const checkInDate = new Date(booking.checkInDate);
    const daysBeforeCheckIn =
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    let refundPercent = 0;
    switch (cancel_policy) {
      case CancelPolicy.FLEXIBLE:
        if (now < checkInDate) refundPercent = 100;
        break;
      case CancelPolicy.MODERATE:
        if (daysBeforeCheckIn > 7) refundPercent = 100;
        else if (daysBeforeCheckIn >= 0) refundPercent = 50;
        break;
      case CancelPolicy.STRICT:
        refundPercent = 0;
        break;
    }
    const deposit_paid_amount = booking.deposit_paid_amount || 0;
    const refund_amount = Math.round(
      (deposit_paid_amount * refundPercent) / 100,
    );
    (booking as any).refund_amount = refund_amount;
    await booking.save();

    // Create status change notifications
    await this.createStatusChangeNotification(booking, BookingStatus.CANCELLED);

    return {
      success: true,
      message: `Hủy booking thành công. Số tiền hoàn lại: ${refund_amount}`,
    };
  }

  // ====================== INTERNAL METHODS ======================

  /**
   * Tìm các booking của một guest
   */
  private async findBookingsByGuest(
    guestId: string,
    queryDto: QueryBookingDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query với guestId
      const guestObjectId = new Types.ObjectId(guestId);
      const query: FilterQuery<Booking> = {
        guestId: guestObjectId,
        isDeleted: includeDeleted,
      };

      // Thêm các bộ lọc khác
      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.payment_status = filters.paymentStatus;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(query, {
        sort,
        skip,
        limit,
        populate: [
          {
            path: 'listingId',
            select: 'title address images price_per_night cancel_policy',
          },
          { path: 'voucher_id', select: 'code discount_percent' },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo guest');
    }
  }

  /**
   * Tìm các booking của một property (cho staff quản lý property đó)
   */
  private async findBookingsByProperty(
    propertyId: string,
    queryDto: QueryBookingDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query với propertyId
      const propertyObjectId = new Types.ObjectId(propertyId);
      const query: FilterQuery<Booking> = {
        propertyId: propertyObjectId,
        isDeleted: includeDeleted,
      };

      // Thêm các bộ lọc khác
      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.payment_status = filters.paymentStatus;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(query, {
        sort,
        skip,
        limit,
        populate: [
          {
            path: 'listingId',
            select: 'title address images price_per_night cancel_policy',
          },
          { path: 'guestId', select: 'name avatar email phone' },
          { path: 'voucher_id', select: 'code discount_percent' },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo property');
    }
  }

  /**
   * Tìm các booking của một listing
   */
  private async findBookingsByListing(
    listingId: string,
    queryDto: QueryBookingDto,
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query với listingId
      const listingObjectId = new Types.ObjectId(listingId);
      const query: FilterQuery<Booking> = {
        listingId: listingObjectId,
        isDeleted: includeDeleted,
      };

      // Thêm các bộ lọc khác
      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.payment_status = filters.paymentStatus;

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(query, {
        sort,
        skip,
        limit,
        populate: [
          { path: 'guestId', select: 'name avatar email phone' },
          { path: 'voucher_id', select: 'code discount_percent' },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo listing');
    }
  }

  /**
   * Cập nhật trạng thái booking
   */
  private async changeStatus(
    id: string,
    status: BookingStatus,
    user: JwtPayload,
  ): Promise<Booking> {
    try {
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }

      // Check permission using internal method
      const booking = await this.bookingRepo.findById(id);
      if (!booking) {
        throw new NotFoundException(`Không tìm thấy booking với ID ${id}`);
      }

      // Cập nhật trạng thái booking
      const updatedBooking = await this.bookingRepo.updateById(
        id,
        { status },
        user._id,
      );

      if (!updatedBooking) {
        throw new NotFoundException(
          `Không thể cập nhật trạng thái cho booking với ID ${id}`,
        );
      }

      // Modules are independent - booking status doesn't affect listing status
      // Listing availability is checked via booking conflict validation

      return updatedBooking;
    } catch (error) {
      this.handleError(error, 'Cập nhật trạng thái booking');
    }
  }

  /**
   * Helper method to create admin notification and avoid duplicates
   */
  private async createAdminNotificationSafely(
    bookingId: string,
    adminId: string,
    notificationData: any,
    notificationType: 'new_booking' | 'status_change' | 'summary',
  ): Promise<void> {
    const cacheKey = `${bookingId}-${notificationType}`;

    if (!this.adminNotificationCache.has(cacheKey)) {
      this.adminNotificationCache.set(cacheKey, new Set());
    }

    const processedAdmins = this.adminNotificationCache.get(cacheKey)!;

    if (processedAdmins.has(adminId)) {
      this.logger.warn(
        `[DUPLICATE PREVENTION] Skipping duplicate ${notificationType} notification for admin ${adminId} on booking ${bookingId}`,
      );
      return;
    }

    processedAdmins.add(adminId);
    await this.notificationsService.create(notificationData);

    // Clean up cache after 5 minutes to prevent memory leak
    setTimeout(
      () => {
        this.adminNotificationCache.delete(cacheKey);
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Clear admin notification cache (for debugging)
   */
  clearAdminNotificationCache(): void {
    const cacheSize = this.adminNotificationCache.size;
    this.adminNotificationCache.clear();
    this.logger.log(
      `[CACHE CLEAR] Cleared admin notification cache (${cacheSize} entries)`,
    );
  }

  /**
   * Get admin notification cache status (for debugging)
   */
  getAdminNotificationCacheStatus(): any {
    const cacheEntries = Array.from(this.adminNotificationCache.entries()).map(
      ([key, value]) => ({
        key,
        processedAdmins: Array.from(value),
      }),
    );

    return {
      totalEntries: this.adminNotificationCache.size,
      entries: cacheEntries,
    };
  }

  /**
   * Helper method to check if user is actual staff (not admin)
   */
  private async isActualStaff(userId: Types.ObjectId): Promise<boolean> {
    try {
      const userInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: userId });

      return !!(userInfo && userInfo.role === 'staff');
    } catch (error) {
      this.logger.error('Error checking user role:', error);
      return false;
    }
  }

  /**
   * Tạo thông báo cho staff khi có booking mới
   */
  private async createStaffNotifications(
    propertyId: string,
    booking: Booking,
    listing: { _id: Types.ObjectId; title?: string },
    finalAmount: number,
  ): Promise<void> {
    try {
      // Lấy danh sách staff của property từ PropertyStaffAssignmentService
      const staffAssignments =
        await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        );

      if (staffAssignments.length === 0) {
        this.logger.debug(`No staff assigned to property ${propertyId}`);
        return;
      }

      // Get guest information for detailed notification
      const guestInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: booking.guestId });

      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );
      const checkOutDate = new Date(booking.check_out_date).toLocaleDateString(
        'vi-VN',
      );
      const bookingCode = (booking._id as Types.ObjectId)
        .toString()
        .slice(-8)
        .toUpperCase();
      const guestName = guestInfo?.name || 'Khách hàng';
      const guestPhone = guestInfo?.phone || '';
      const propertyName = listing.title || 'Property';

      // Find first actual staff member to create ONE representative staff notification
      let representativeStaff: any = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          // Check if this is actual staff, not admin
          if (await this.isActualStaff(assignment.staffId._id)) {
            const staffUser = assignment.staffId as any;
            allStaffEmails.push(staffUser.email || staffUser._id.toString());

            // Use first actual staff as representative
            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create ONE staff notification if we found any staff
      if (representativeStaff) {
        const createNotificationDto = {
          user_id: representativeStaff._id.toString(),
          recipient_type: RecipientType.STAFF,
          title: `🏨 Đặt phòng mới - ${propertyName}`,
          message: `Khách hàng ${guestName}${guestPhone ? ` (${guestPhone})` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')}đ. Mã booking: #${bookingCode}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: booking._id,
            propertyId: propertyId,
            listingId: listing._id,
            amount: finalAmount,
            guestName,
            guestPhone,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.check_out_date,
            guests: booking.guests,
            bookingCode,
            allStaffEmails: allStaffEmails.join(', '), // Store all staff emails for reference
          },
        };

        await this.notificationsService.create(createNotificationDto);
      }
    } catch (error) {
      this.logger.error('Error creating staff notifications:', error);
    }
  }

  /**
   * Tạo thông báo khi trạng thái booking thay đổi
   */
  private async createStatusChangeNotification(
    booking: Booking,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const guestId = (booking.guestId as Types.ObjectId).toString();

      // Validate guest ID
      if (!guestId || guestId === 'null' || guestId === 'undefined') {
        this.logger.error(
          `[STATUS CHANGE] Invalid guest ID for booking ${bookingId}: ${guestId}`,
        );
        throw new Error('Invalid guest ID');
      }

      // Get property and listing information for room name
      let propertyName = 'Căn hộ';
      let listingTitle = '';

      try {
        if (booking.propertyId) {
          const property = await this.propertyService.findOne(
            booking.propertyId.toString(),
          );
          if (property) {
            propertyName = property.name || 'Căn hộ';
          }
        }

        if (booking.listingId) {
          const listing = await this.listingService.findOne(
            booking.listingId.toString(),
          );
          if (listing) {
            listingTitle = listing.title || '';
          }
        }
      } catch (error) {
        this.logger.warn(
          'Could not fetch property/listing details for notification:',
          error,
        );
      }

      const roomName = listingTitle || propertyName;

      // Tạo thông báo cho khách hàng với tiêu đề và nội dung chuyên nghiệp
      const statusData = {
        [BookingStatus.CONFIRMED]: {
          title: '✅ Đặt phòng được xác nhận',
          message: `Chúc mừng! Đặt phòng tại ${roomName} đã được xác nhận thành công. Chúng tôi rất mong được phục vụ bạn.`,
        },
        [BookingStatus.CANCELLED]: {
          title: '❌ Đặt phòng đã bị hủy',
          message: `Đặt phòng tại ${roomName} đã được hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.`,
        },
        [BookingStatus.COMPLETED]: {
          title: '🎉 Đặt phòng hoàn thành',
          message: `Cảm ơn bạn đã lưu trú tại ${roomName}! Hy vọng bạn đã có trải nghiệm tuyệt vời.`,
        },
        [BookingStatus.REJECTED]: {
          title: '⚠️ Đặt phòng bị từ chối',
          message: `Rất tiếc, đặt phòng tại ${roomName} không thể được chấp nhận. Vui lòng liên hệ để được hỗ trợ.`,
        },
      };

      const notificationData = statusData[newStatus] || {
        title: '📋 Cập nhật đặt phòng',
        message: `Trạng thái đặt phòng tại ${roomName} đã được cập nhật thành ${newStatus}.`,
      };

      try {
        await this.notificationsService.create({
          user_id: guestId,
          recipient_type: RecipientType.GUEST,
          title: notificationData.title,
          message: `${notificationData.message} Mã đặt phòng: ${bookingCode.toUpperCase()}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
          metadata: {
            bookingId: bookingId,
            propertyId: booking.propertyId?.toString(),
            listingId: booking.listingId?.toString(),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            roomName: roomName,
            propertyName: propertyName,
            listingTitle: listingTitle,
          },
        });
      } catch (guestNotificationError) {
        this.logger.error(
          `[GUEST NOTIFICATION] Failed to create status change notification for guest ${guestId}, booking ${bookingId}:`,
          guestNotificationError,
        );
        // Don't throw - continue with staff/admin notifications
      }

      // Create notification for staff managing this property
      try {
        await this.createStaffStatusChangeNotification(booking, newStatus);
      } catch (staffNotificationError) {
        this.logger.error(
          `[STAFF NOTIFICATION] Failed to create status change notification for booking ${bookingId}:`,
          staffNotificationError,
        );
      }

      // Create notification for admin
      try {
        await this.createAdminStatusChangeNotification(booking, newStatus);
      } catch (adminNotificationError) {
        this.logger.error(
          `[ADMIN NOTIFICATION] Failed to create status change notification for booking ${bookingId}:`,
          adminNotificationError,
        );
      }

      // Nếu status = COMPLETED, tạo thông báo đánh giá phòng
      if (newStatus === BookingStatus.COMPLETED) {
        await this.reviewsService.createReviewNotification(bookingId);
        this.logger.log(
          `Created review notification for completed booking ${bookingId}`,
        );
      }
    } catch (error) {
      this.logger.error('Error creating status change notification:', error);
    }
  }

  /**
   * Tạo thông báo cho staff khi trạng thái booking thay đổi
   */
  private async createStaffStatusChangeNotification(
    booking: any,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const propertyId = booking.propertyId?.toString();

      if (!propertyId) return;

      // Get staff assigned to this property
      const staffAssignments =
        await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        );

      // Get guest and property information for detailed notification
      const guestInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: booking.guestId });

      const propertyInfo = await this.bookingRepo
        .getModel()
        .db.collection('properties')
        .findOne({ _id: booking.propertyId });

      const guestName = guestInfo?.name || 'Khách hàng';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );

      const statusMessages = {
        [BookingStatus.CONFIRMED]: '✅ Đã xác nhận',
        [BookingStatus.CANCELLED]: '❌ Đã hủy',
        [BookingStatus.COMPLETED]: '✅ Hoàn thành',
        [BookingStatus.REJECTED]: '⚠️ Từ chối',
      };

      const statusIcon = statusMessages[newStatus] || `🔄 ${newStatus}`;

      // Find first actual staff member to create ONE representative staff notification
      let representativeStaff: any = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          // Check if this is actual staff, not admin
          if (await this.isActualStaff(assignment.staffId._id)) {
            const staffUser = assignment.staffId as any;
            allStaffEmails.push(staffUser.email || staffUser._id.toString());

            // Use first actual staff as representative
            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create ONE staff status change notification if we found any staff
      if (representativeStaff) {
        await this.notificationsService.create({
          user_id: representativeStaff._id.toString(),
          recipient_type: RecipientType.STAFF,
          title: `${statusIcon} Booking #${bookingCode}`,
          message: `Booking của khách ${guestName} tại ${propertyName} (${checkInDate}) đã chuyển từ "${booking.status}" sang "${newStatus}". Cần xử lý ngay!`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: propertyId,
            listingId: booking.listingId?.toString(),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            guestName,
            propertyName,
            checkInDate: booking.checkInDate,
            bookingCode,
            allStaffEmails: allStaffEmails.join(', '), // Store all staff emails for reference
          },
        });
      }
    } catch (error) {
      this.logger.error(
        'Error creating staff status change notification:',
        error,
      );
    }
  }

  /**
   * Tạo thông báo cho admin khi có booking mới
   */
  private async createAdminNewBookingNotification(
    booking: any,
    listing: any,
    finalAmount: number,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8).toUpperCase();

      // Get guest information for detailed notification
      const guestInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: booking.guestId });

      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );
      const checkOutDate = new Date(booking.check_out_date).toLocaleDateString(
        'vi-VN',
      );
      const guestName = guestInfo?.name || 'Khách hàng';
      const guestEmail = guestInfo?.email || '';
      const guestPhone = guestInfo?.phone || '';
      const propertyName = listing.title || 'Property';

      // Get all admin users
      const adminUsers = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .find({ role: 'admin' })
        .toArray();

      // Create ONE notification for admin (pick first admin as representative)
      if (adminUsers.length > 0) {
        const representativeAdmin = adminUsers[0]; // Use first admin as representative
        const adminId = representativeAdmin._id.toString();

        const notificationData = {
          user_id: adminId,
          recipient_type: RecipientType.ADMIN,
          title: `📊 Booking mới hệ thống - ${propertyName}`,
          message: `Khách hàng ${guestName}${guestEmail ? ` (${guestEmail})` : ''}${guestPhone ? ` - ${guestPhone}` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Doanh thu: ${finalAmount.toLocaleString('vi-VN')}đ. Mã: #${bookingCode}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: booking.propertyId?.toString(),
            listingId: listing._id?.toString(),
            amount: finalAmount,
            bookingStatus: BookingStatus.PENDING,
            guestName,
            guestEmail,
            guestPhone,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.check_out_date,
            guests: booking.guests,
            bookingCode,
            nights: booking.nights,
            allAdminEmails: adminUsers.map((admin) => admin.email).join(', '), // Store all admin emails for reference
          },
        };

        await this.createAdminNotificationSafely(
          bookingId,
          adminId,
          notificationData,
          'new_booking',
        );
      }
    } catch (error) {
      this.logger.error(
        'Error creating admin new booking notification:',
        error,
      );
    }
  }

  /**
   * Tạo thông báo cho admin khi trạng thái booking thay đổi
   */
  private async createAdminStatusChangeNotification(
    booking: any,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8).toUpperCase();

      // Get guest, property, and booking amount information
      const [guestInfo, propertyInfo] = await Promise.all([
        this.bookingRepo
          .getModel()
          .db.collection('users')
          .findOne({ _id: booking.guestId }),
        this.bookingRepo
          .getModel()
          .db.collection('properties')
          .findOne({ _id: booking.propertyId }),
      ]);

      const guestName = guestInfo?.name || 'Khách hàng';
      const guestEmail = guestInfo?.email || '';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );
      const amount = booking.final_amount || booking.total_price || 0;

      const statusMessages = {
        [BookingStatus.CONFIRMED]: '✅ Xác nhận',
        [BookingStatus.CANCELLED]: '❌ Hủy bỏ',
        [BookingStatus.COMPLETED]: '✅ Hoàn thành',
        [BookingStatus.REJECTED]: '⚠️ Từ chối',
      };

      const statusIcon = statusMessages[newStatus] || `🔄 ${newStatus}`;

      // Get all admin users
      const adminUsers = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .find({ role: 'admin' })
        .toArray();

      // Create ONE notification for admin (pick first admin as representative)
      if (adminUsers.length > 0) {
        const representativeAdmin = adminUsers[0]; // Use first admin as representative
        const adminId = representativeAdmin._id.toString();

        const notificationData = {
          user_id: adminId,
          recipient_type: RecipientType.ADMIN,
          title: `${statusIcon} Booking #${bookingCode} - ${propertyName}`,
          message: `Booking của ${guestName}${guestEmail ? ` (${guestEmail})` : ''} tại ${propertyName} (${checkInDate}) đã chuyển từ "${booking.status}" → "${newStatus}". Giá trị: ${amount.toLocaleString('vi-VN')}đ`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: booking.propertyId?.toString(),
            listingId: booking.listingId?.toString(),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            guestName,
            guestEmail,
            propertyName,
            checkInDate: booking.checkInDate,
            bookingCode,
            amount,
            allAdminEmails: adminUsers.map((admin) => admin.email).join(', '), // Store all admin emails for reference
          },
        };

        await this.createAdminNotificationSafely(
          bookingId,
          adminId,
          notificationData,
          'status_change',
        );
      }
    } catch (error) {
      this.logger.error(
        'Error creating admin status change notification:',
        error,
      );
    }
  }

  /**
   * Xử lý lỗi thống nhất
   */
  private handleError(error: any, operation: string): never {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    this.logger.error(
      `Lỗi khi ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  }

  // =========================== STATISTICS METHODS ===========================

  /**
   * Tạo filter cơ bản cho thống kê
   */
  private createStatisticsFilter(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ): any {
    const filter: any = { isDeleted: false };

    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) filter.created_at.$gte = new Date(startDate);
      if (endDate) filter.created_at.$lte = new Date(endDate);
    }

    if (propertyId) {
      filter.propertyId = new Types.ObjectId(propertyId);
    }

    if (listingId) {
      filter.listingId = new Types.ObjectId(listingId);
    }

    return filter;
  }

  /**
   * Lấy thống kê tổng quan
   */

  async getOverviewStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
    groupBy?: string,
  ): Promise<
    BookingOverviewStatistics & {
      statusBreakdown: BookingStatusStatistics;
      chartData: BookingChartDataPoint[];
    }
  > {
    // Sử dụng 7 ngày gần nhất nếu không có ngày được chỉ định
    let actualStartDate: Date | undefined;
    let actualEndDate: Date | undefined;

    if (!startDate && !endDate) {
      const defaultRange = getDefaultDateRange();
      actualStartDate = defaultRange.startDate;
      actualEndDate = defaultRange.endDate;
    } else {
      if (startDate) actualStartDate = new Date(startDate);
      if (endDate) actualEndDate = new Date(endDate);
    }

    // Tạo filter cho thống kê chính (sử dụng cùng khoảng thời gian)
    const filter = this.createStatisticsFilter(
      actualStartDate?.toISOString(),
      actualEndDate?.toISOString(),
      propertyId,
      listingId,
    );

    const finalGroupBy = determineGroupBy(
      actualStartDate!,
      actualEndDate!,
      groupBy,
    );
    const { format: groupFormat, labelFn } = getGroupFormat(finalGroupBy);

    // Lấy dữ liệu cho biểu đồ (sử dụng cùng khoảng thời gian)
    const chartMatch: any = { ...filter };
    if (actualStartDate || actualEndDate) {
      chartMatch.created_at = {};
      if (actualStartDate) chartMatch.created_at.$gte = actualStartDate;
      if (actualEndDate) chartMatch.created_at.$lte = actualEndDate;
    }

    const chartDataAgg = await this.bookingRepo.getModel().aggregate([
      { $match: chartMatch },
      {
        $group: {
          _id: {
            group: {
              $dateToString: { format: groupFormat, date: '$created_at' },
            },
          },
          revenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                0,
              ],
            },
          },
          bookings: {
            $sum: {
              $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, 1, 0],
            },
          },
          nights: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$nights',
                0,
              ],
            },
          },
        },
      },
      { $sort: { '_id.group': 1 } },
    ]);

    // Chuẩn hóa dữ liệu cho biểu đồ
    const labelMap = new Map<
      string,
      { revenue: number; bookings: number; nights: number }
    >();
    chartDataAgg.forEach((item) => {
      labelMap.set(item._id.group, {
        revenue: item.revenue,
        bookings: item.bookings,
        nights: item.nights,
      });
    });

    const labels = generateLabels(
      actualStartDate!,
      actualEndDate!,
      finalGroupBy,
    );

    const chartData: BookingChartDataPoint[] = labels.map((label) => {
      const data = labelMap.get(label) || {
        revenue: 0,
        bookings: 0,
        nights: 0,
      };
      return {
        label: labelFn(String(label)),
        revenue: data.revenue,
        bookings: data.bookings,
        occupancyRate: data.nights > 0 ? 100 : 0,
      };
    });

    // Thống kê tổng quan - chỉ tính doanh thu từ booking đã xác nhận/hoàn thành
    const overviewStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                0,
              ],
            },
          },
          totalNights: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$nights',
                0,
              ],
            },
          },
          totalGuests: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$guests',
                0,
              ],
            },
          },
          totalInfants: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$infants',
                0,
              ],
            },
          },
          averageBookingValue: {
            $avg: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                null,
              ],
            },
          },
        },
      },
    ]);

    // Thống kê theo trạng thái
    const statusStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Tính toán tỉ lệ lấp đầy dựa trên khoảng thời gian thực tế
    const daysInPeriod =
      actualStartDate && actualEndDate
        ? Math.ceil(
            (actualEndDate.getTime() - actualStartDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1
        : 7; // Mặc định 7 ngày

    const overview = overviewStats[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      totalNights: 0,
      totalGuests: 0,
      totalInfants: 0,
      averageBookingValue: 0,
    };

    // Tạo object trạng thái
    const statusBreakdown: BookingStatusStatistics = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      rejected: 0,
      confirmationRate: 0,
      cancellationRate: 0,
    };

    statusStats.forEach(
      (stat: { _id: keyof BookingStatusStatistics; count: number }) => {
        if (stat._id in statusBreakdown) {
          statusBreakdown[stat._id] = stat.count;
        }
      },
    );

    // Tính tỉ lệ
    if (overview.totalBookings > 0) {
      statusBreakdown.confirmationRate = Math.round(
        ((statusBreakdown.confirmed + statusBreakdown.completed) /
          overview.totalBookings) *
          100,
      );
      statusBreakdown.cancellationRate = Math.round(
        (statusBreakdown.cancelled / overview.totalBookings) * 100,
      );
    }

    // Thống kê voucher
    const voucherStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVouchersUsed: {
            $sum: { $cond: [{ $ne: ['$voucher_id', null] }, 1, 0] },
          },
          totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
          averageVoucherDiscount: { $avg: '$voucher_discount_amount' },
        },
      },
    ]);

    const voucherData = voucherStats[0] || {
      totalVouchersUsed: 0,
      totalVoucherDiscount: 0,
      averageVoucherDiscount: 0,
    };

    // Thống kê services
    const servicesStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalServicesRevenue: { $sum: '$services_total_amount' },
          totalServicesBooked: {
            $sum: { $size: { $ifNull: ['$selected_services', []] } },
          },
        },
      },
    ]);

    const servicesData = servicesStats[0] || {
      totalServicesRevenue: 0,
      totalServicesBooked: 0,
    };

    // Top services used
    const topServices = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      { $unwind: '$selected_services' },
      {
        $group: {
          _id: '$selected_services.service_id',
          serviceName: { $first: '$selected_services.service_name' },
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: '$selected_services.total_price' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
    ]);

    return {
      totalBookings: overview.totalBookings,
      totalRevenue: overview.totalRevenue,
      totalNights: overview.totalNights,
      averageOccupancyRate: Math.round(
        ((overview.totalNights as number) / daysInPeriod) * 100,
      ),
      averageBookingValue: Math.round(overview.averageBookingValue as number),
      totalGuests: overview.totalGuests,
      totalInfants: overview.totalInfants,
      totalVouchersUsed: voucherData.totalVouchersUsed,
      totalVoucherDiscount: voucherData.totalVoucherDiscount,
      averageVoucherDiscount: Math.round(
        voucherData.averageVoucherDiscount || 0,
      ),
      voucherUsageRate:
        overview.totalBookings > 0
          ? Math.round(
              (voucherData.totalVouchersUsed / overview.totalBookings) * 100,
            )
          : 0,
      totalServicesRevenue: servicesData.totalServicesRevenue,
      totalServicesBooked: servicesData.totalServicesBooked,
      averageServicesPerBooking:
        overview.totalBookings > 0
          ? Math.round(
              (servicesData.totalServicesBooked / overview.totalBookings) * 10,
            ) / 10
          : 0,
      topServicesUsed: topServices.map((service: any) => ({
        serviceId: service._id.toString(),
        serviceName: service.serviceName,
        usageCount: service.usageCount,
        totalRevenue: service.totalRevenue,
      })),
      statusBreakdown,
      chartData,
    };
  }

  /**
   * Lấy thống kê tài chính
   */
  async getFinancialStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ): Promise<BookingFinancialStatistics> {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    // Thống kê tài chính tổng quan - chỉ tính doanh thu từ booking đã xác nhận/hoàn thành
    const financialStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                0,
              ],
            },
          },
          totalServiceFees: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$service_fee',
                0,
              ],
            },
          },
          totalTaxAmount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$tax_amount',
                0,
              ],
            },
          },
          totalRefunds: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, '$refund_amount', 0],
            },
          },
          averageBookingValue: {
            $avg: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                null,
              ],
            },
          },
        },
      },
    ]);

    // Thống kê doanh thu theo tháng - chỉ tính từ booking đã xác nhận/hoàn thành
    const revenueByMonth = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          revenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$final_amount',
                0,
              ],
            },
          },
          bookings: {
            $sum: {
              $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, 1, 0],
            },
          },
          voucherDiscount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$voucher_discount_amount',
                0,
              ],
            },
          },
          servicesRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$services_total_amount',
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    const financial = financialStats[0] || {
      totalRevenue: 0,
      totalServiceFees: 0,
      totalTaxAmount: 0,
      totalRefunds: 0,
      averageBookingValue: 0,
    };

    // Calculate additional financial metrics - chỉ tính từ booking đã xác nhận/hoàn thành
    const voucherServicesStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVoucherDiscount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$voucher_discount_amount',
                0,
              ],
            },
          },
          totalServicesRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$services_total_amount',
                0,
              ],
            },
          },
          totalRevenueBeforeVoucher: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                '$subtotal_amount',
                0,
              ],
            },
          },
        },
      },
    ]);

    const voucherServicesData = voucherServicesStats[0] || {
      totalVoucherDiscount: 0,
      totalServicesRevenue: 0,
      totalRevenueBeforeVoucher: 0,
    };

    return {
      totalRevenue: financial.totalRevenue,
      totalServiceFees: financial.totalServiceFees,
      totalTaxAmount: financial.totalTaxAmount,
      totalRefunds: financial.totalRefunds,
      netRevenue: financial.totalRevenue - financial.totalRefunds,
      averageBookingValue: Math.round(financial.averageBookingValue as number),
      totalVoucherDiscount: voucherServicesData.totalVoucherDiscount,
      totalRevenueBeforeVoucher: voucherServicesData.totalRevenueBeforeVoucher,
      voucherDiscountPercentage:
        voucherServicesData.totalRevenueBeforeVoucher > 0
          ? Math.round(
              (voucherServicesData.totalVoucherDiscount /
                voucherServicesData.totalRevenueBeforeVoucher) *
                100,
            )
          : 0,
      totalServicesRevenue: voucherServicesData.totalServicesRevenue,
      servicesRevenuePercentage:
        financial.totalRevenue > 0
          ? Math.round(
              (voucherServicesData.totalServicesRevenue /
                financial.totalRevenue) *
                100,
            )
          : 0,
      averageServicesRevenuePerBooking: Math.round(
        voucherServicesData.totalServicesRevenue /
          (financial.totalRevenue > 0 ? financial.totalRevenue : 1),
      ),
      revenueByMonth: revenueByMonth.map((item: any) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        revenue: item.revenue,
        bookings: item.bookings,
        voucherDiscount: item.voucherDiscount || 0,
        servicesRevenue: item.servicesRevenue || 0,
      })),
    };
  }

  /**
   * Lấy thống kê khách hàng
   */
  async getCustomerStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ): Promise<BookingCustomerStatistics> {
    try {
      this.logger.log('getCustomerStatistics called with:', {
        startDate,
        endDate,
        propertyId,
        listingId,
      });

      const filter = this.createStatisticsFilter(
        startDate,
        endDate,
        propertyId,
        listingId,
      );

      this.logger.log('Statistics filter:', filter);

      // Thống kê khách hàng (loại bỏ guestId null)
      const customerStats = await this.bookingRepo.getModel().aggregate([
        { $match: { ...filter, guestId: { $ne: null } } },
        {
          $group: {
            _id: '$guestId',
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$final_amount' },
            totalNights: { $sum: '$nights' },
            totalGuests: { $sum: '$guests' },
            guestName: { $first: '$guest_name' },
          },
        },
      ]);

      // Thống kê khách hàng mới vs quay lại (loại bỏ guestId null)
      const newCustomers = await this.bookingRepo.getModel().aggregate([
        { $match: { ...filter, guestId: { $ne: null } } },
        {
          $group: {
            _id: '$guestId',
            firstBooking: { $min: '$created_at' },
          },
        },
        {
          $match: {
            firstBooking: {
              $gte: startDate
                ? new Date(startDate)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $count: 'count',
        },
      ]);

      // Top khách hàng
      const topCustomers = customerStats
        .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map((customer: any) => ({
          customerId: customer._id ? customer._id.toString() : 'unknown',
          customerName: customer.guestName || 'Unknown Guest',
          totalBookings: customer.totalBookings,
          totalSpent: customer.totalSpent,
        }));

      const totalCustomers = customerStats.length;
      const newCustomersCount = newCustomers[0]?.count || 0;
      const returningCustomers = totalCustomers - newCustomersCount;

      // Tính trung bình
      const totalNights = customerStats.reduce(
        (sum: number, customer: any) => sum + customer.totalNights,
        0,
      );
      const totalGuests = customerStats.reduce(
        (sum: number, customer: any) => sum + customer.totalGuests,
        0,
      );
      const totalBookings = customerStats.reduce(
        (sum: number, customer: any) => sum + customer.totalBookings,
        0,
      );

      // Voucher usage by customers (loại bỏ guestId null)
      const voucherUsageStats = await this.bookingRepo.getModel().aggregate([
        { $match: { ...filter, guestId: { $ne: null } } },
        {
          $group: {
            _id: '$guestId',
            guestName: { $first: '$guest_name' },
            voucherUsageCount: {
              $sum: { $cond: [{ $ne: ['$voucher_id', null] }, 1, 0] },
            },
            totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
          },
        },
        { $match: { voucherUsageCount: { $gt: 0 } } },
      ]);

      const customersUsingVouchers = voucherUsageStats.length;
      const topVoucherUsers = voucherUsageStats
        .sort(
          (a: any, b: any) => b.totalVoucherDiscount - a.totalVoucherDiscount,
        )
        .slice(0, 10)
        .map((user: any) => ({
          customerId: user._id ? user._id.toString() : 'unknown',
          customerName: user.guestName || 'Unknown Guest',
          voucherUsageCount: user.voucherUsageCount,
          totalVoucherDiscount: user.totalVoucherDiscount,
        }));

      // Services usage by customers (loại bỏ guestId null)
      const servicesUsageStats = await this.bookingRepo.getModel().aggregate([
        { $match: { ...filter, guestId: { $ne: null } } },
        { $unwind: '$selected_services' },
        {
          $group: {
            _id: '$guestId',
            guestName: { $first: '$guest_name' },
            servicesUsageCount: { $sum: 1 },
            totalServicesSpent: { $sum: '$selected_services.total_price' },
          },
        },
      ]);

      const customersUsingServices = servicesUsageStats.length;
      const topServicesUsers = servicesUsageStats
        .sort((a: any, b: any) => b.totalServicesSpent - a.totalServicesSpent)
        .slice(0, 10)
        .map((user: any) => ({
          customerId: user._id ? user._id.toString() : 'unknown',
          customerName: user.guestName || 'Unknown Guest',
          servicesUsageCount: user.servicesUsageCount,
          totalServicesSpent: user.totalServicesSpent,
        }));

      return {
        totalCustomers,
        newCustomers: newCustomersCount,
        returningCustomers,
        averageNightsPerBooking:
          totalBookings > 0
            ? Math.round((totalNights / totalBookings) * 10) / 10
            : 0,
        averageGuestsPerBooking:
          totalBookings > 0
            ? Math.round((totalGuests / totalBookings) * 10) / 10
            : 0,
        customersUsingVouchers,
        averageVoucherUsagePerCustomer:
          customersUsingVouchers > 0
            ? Math.round(
                (voucherUsageStats.reduce(
                  (sum: number, user: any) => sum + user.voucherUsageCount,
                  0,
                ) /
                  customersUsingVouchers) *
                  10,
              ) / 10
            : 0,
        topVoucherUsers,
        customersUsingServices,
        averageServicesUsagePerCustomer:
          customersUsingServices > 0
            ? Math.round(
                (servicesUsageStats.reduce(
                  (sum: number, user: any) => sum + user.servicesUsageCount,
                  0,
                ) /
                  customersUsingServices) *
                  10,
              ) / 10
            : 0,
        topServicesUsers,
        topCustomers,
      };
    } catch (error) {
      this.logger.error('getCustomerStatistics error:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê theo thời gian
   */
  async getTimelineStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ): Promise<BookingTimelineStatistics> {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    // Thống kê theo ngày
    const bookingsByDay = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    // Thống kê theo tuần
    const bookingsByWeek = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            week: { $week: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.week': 1 },
      },
    ]);

    // Thống kê theo tháng
    const bookingsByMonth = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$final_amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    // Tính thời gian đặt trước trung bình
    const advanceBookingStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $addFields: {
          advanceDays: {
            $ceil: {
              $divide: [
                { $subtract: ['$checkInDate', '$created_at'] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          averageAdvanceDays: { $avg: '$advanceDays' },
          averageStayDuration: { $avg: '$nights' },
        },
      },
    ]);

    const timelineStats = advanceBookingStats[0] || {
      averageAdvanceDays: 0,
      averageStayDuration: 0,
    };

    return {
      bookingsByDay: bookingsByDay.map((item: any) => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      bookingsByWeek: bookingsByWeek.map((item: any) => ({
        week: `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      bookingsByMonth: bookingsByMonth.map((item: any) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        bookings: item.bookings,
        revenue: item.revenue,
      })),
      averageAdvanceBookingDays: Math.round(
        timelineStats.averageAdvanceDays as number,
      ),
      averageStayDuration:
        Math.round((timelineStats.averageStayDuration as number) * 10) / 10,
    };
  }

  /**
   * Lấy thống kê voucher
   */
  async getVoucherStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ) {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    const voucherStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalVouchersUsed: {
            $sum: { $cond: [{ $ne: ['$voucher_id', null] }, 1, 0] },
          },
          totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
          averageVoucherDiscount: { $avg: '$voucher_discount_amount' },
        },
      },
    ]);

    const stats = voucherStats[0] || {
      totalBookings: 0,
      totalVouchersUsed: 0,
      totalVoucherDiscount: 0,
      averageVoucherDiscount: 0,
    };

    return {
      totalBookings: stats.totalBookings,
      totalVouchersUsed: stats.totalVouchersUsed,
      totalVoucherDiscount: stats.totalVoucherDiscount,
      averageVoucherDiscount: Math.round(stats.averageVoucherDiscount || 0),
      voucherUsageRate:
        stats.totalBookings > 0
          ? Math.round((stats.totalVouchersUsed / stats.totalBookings) * 100)
          : 0,
    };
  }

  /**
   * Lấy thống kê services
   */
  async getServicesStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ) {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    const servicesStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalServicesRevenue: { $sum: '$services_total_amount' },
          totalServicesBooked: {
            $sum: { $size: { $ifNull: ['$selected_services', []] } },
          },
        },
      },
    ]);

    const stats = servicesStats[0] || {
      totalBookings: 0,
      totalServicesRevenue: 0,
      totalServicesBooked: 0,
    };

    // Top services used
    const topServices = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      { $unwind: '$selected_services' },
      {
        $group: {
          _id: '$selected_services.service_id',
          serviceName: { $first: '$selected_services.service_name' },
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: '$selected_services.total_price' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
    ]);

    return {
      totalBookings: stats.totalBookings,
      totalServicesRevenue: stats.totalServicesRevenue,
      totalServicesBooked: stats.totalServicesBooked,
      averageServicesPerBooking:
        stats.totalBookings > 0
          ? Math.round((stats.totalServicesBooked / stats.totalBookings) * 10) /
            10
          : 0,
      topServicesUsed: topServices.map((service: any) => ({
        serviceId: service._id.toString(),
        serviceName: service.serviceName,
        usageCount: service.usageCount,
        totalRevenue: service.totalRevenue,
      })),
    };
  }

  /**
   * Lấy thống kê services theo user
   */
  async getServicesByUserStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ) {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    const servicesByUser = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      { $unwind: '$selected_services' },
      {
        $group: {
          _id: '$guestId',
          guestName: { $first: '$guest_name' },
          guestEmail: { $first: '$guest_email' },
          servicesUsageCount: { $sum: 1 },
          totalServicesSpent: { $sum: '$selected_services.total_price' },
        },
      },
      { $sort: { totalServicesSpent: -1 } },
      { $limit: 20 },
    ]);

    return {
      servicesByUser: servicesByUser.map((user: any) => ({
        customerId: user._id.toString(),
        customerName: user.guestName,
        customerEmail: user.guestEmail,
        servicesUsageCount: user.servicesUsageCount,
        totalServicesSpent: user.totalServicesSpent,
      })),
    };
  }

  /**
   * Lấy thống kê voucher theo user
   */
  async getVouchersByUserStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
  ) {
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    const vouchersByUser = await this.bookingRepo.getModel().aggregate([
      { $match: { ...filter, voucher_id: { $ne: null } } },
      {
        $group: {
          _id: '$guestId',
          guestName: { $first: '$guest_name' },
          guestEmail: { $first: '$guest_email' },
          voucherUsageCount: { $sum: 1 },
          totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
        },
      },
      { $sort: { totalVoucherDiscount: -1 } },
      { $limit: 20 },
    ]);

    return {
      vouchersByUser: vouchersByUser.map((user: any) => ({
        customerId: user._id.toString(),
        customerName: user.guestName,
        customerEmail: user.guestEmail,
        voucherUsageCount: user.voucherUsageCount,
        totalVoucherDiscount: user.totalVoucherDiscount,
      })),
    };
  }

  /**
   * Lấy thống kê chi tiết (financial, customers, vouchers, services)
   */
  async getDetailedStatistics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
    type: 'financial' | 'customers' | 'all' = 'all',
  ): Promise<any> {
    const result: any = {};

    if (type === 'financial' || type === 'all') {
      result.financial = await this.getFinancialStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
    }

    if (type === 'customers' || type === 'all') {
      result.customers = await this.getCustomerStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
    }

    if (type === 'all') {
      result.vouchers = await this.getVoucherStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
      result.services = await this.getServicesStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
    }

    return result;
  }

  /**
   * Lấy phân tích hành vi user (services, vouchers)
   */
  async getUserAnalytics(
    startDate?: string,
    endDate?: string,
    propertyId?: string,
    listingId?: string,
    type: 'services' | 'vouchers' | 'all' = 'all',
  ): Promise<any> {
    const result: any = {};

    if (type === 'services' || type === 'all') {
      result.servicesByUser = await this.getServicesByUserStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
    }

    if (type === 'vouchers' || type === 'all') {
      result.vouchersByUser = await this.getVouchersByUserStatistics(
        startDate,
        endDate,
        propertyId,
        listingId,
      );
    }

    return result;
  }

  async createRemainingPayment(
    bookingId: string,
    createPaymentDto: any,
    user: JwtPayload,
  ): Promise<PaymentResponseDto> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // ✅ Kiểm tra người gọi có phải là người đặt không (chỉ khi là guest)
    if (
      user.role === 'guest' &&
      booking.guestId &&
      booking.guestId.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('Bạn không có quyền thanh toán booking này');
    }

    // ✅ Kiểm tra trạng thái thanh toán hiện tại
    // Cho phép thanh toán phần còn lại khi:
    // 1. Đã đặt cọc và chưa thanh toán đủ (UNPAID)
    // 2. Đã thanh toán đủ nhưng có thêm dịch vụ (PAID với outstandingAmount > 0)
    const depositPaidAmount =
      booking.deposit_paid_amount || booking.deposit_amount || 0;
    const outstandingAmount = booking.final_amount - depositPaidAmount;

    if (
      !booking.deposit_paid ||
      (booking.payment_status !== PaymentStatus.UNPAID &&
        booking.payment_status !== PaymentStatus.PAID &&
        booking.payment_status !== PaymentStatus.PARTIALLY_PAID)
    ) {
      throw new BadRequestException(
        'Chỉ cho phép thanh toán phần còn lại khi đã đặt cọc hoặc có thêm dịch vụ',
      );
    }

    // Nếu đã PAID hoặc PARTIALLY_PAID, chỉ cho phép thanh toán nếu có outstandingAmount > 0
    if (
      (booking.payment_status === PaymentStatus.PAID ||
        booking.payment_status === PaymentStatus.PARTIALLY_PAID) &&
      outstandingAmount <= 0
    ) {
      throw new BadRequestException('Không còn số tiền nào cần thanh toán');
    }

    // Sử dụng outstandingAmount đã tính ở trên
    if (outstandingAmount <= 0) {
      throw new BadRequestException('Không còn số tiền nào cần thanh toán');
    }

    const paymentService = this.paymentFactory.getPaymentService(
      createPaymentDto.paymentMethod,
    );

    const paymentRequest = {
      ...createPaymentDto,
      bookingId,
      amount: outstandingAmount,
      paymentType: 'remaining',
      description: `Thanh toán phần còn lại cho booking ${bookingId}`,
    };

    const result = await paymentService.createPaymentUrl(paymentRequest);

    return {
      success: result.success,
      paymentMethod: result.paymentMethod,
      paymentUrl: result.paymentUrl,
      orderId: result.orderId,
      amount: result.amount,
      message: result.message,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
    };
  }

  async createStaffRemainingPayment(
    propertyId: string,
    bookingId: string,
    createPaymentDto: CreatePaymentDto,
    user: JwtPayload,
  ): Promise<PaymentResponseDto> {
    // Kiểm tra quyền staff
    if (user.role !== 'admin' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Chỉ admin và staff mới có thể thanh toán cho guest',
      );
    }

    // Kiểm tra staff có được assign cho property này không
    if (user.role === 'staff') {
      const isAssigned =
        await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
          new Types.ObjectId(user._id),
          new Types.ObjectId(propertyId),
        );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Bạn không có quyền thanh toán cho property này',
        );
      }
    }

    const booking = await this.bookingRepo.findOne({
      _id: bookingId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Tính số tiền còn lại cần thanh toán
    const depositPaidAmount =
      booking.deposit_paid_amount || booking.deposit_amount || 0;
    const outstandingAmount = booking.final_amount - depositPaidAmount;

    if (outstandingAmount <= 0) {
      throw new BadRequestException('Không còn số tiền nào cần thanh toán');
    }

    // Kiểm tra trạng thái thanh toán
    if (
      booking.payment_status !== PaymentStatus.UNPAID &&
      booking.payment_status !== PaymentStatus.PAID &&
      booking.payment_status !== PaymentStatus.PARTIALLY_PAID
    ) {
      throw new BadRequestException(
        'Booking không ở trạng thái cho phép thanh toán',
      );
    }

    // Sử dụng amount từ request nếu có, nếu không thì sử dụng outstandingAmount
    const paymentAmount = createPaymentDto.amount || outstandingAmount;

    const paymentService = this.paymentFactory.getPaymentService(
      createPaymentDto.paymentMethod,
    );

    const paymentRequest = {
      ...createPaymentDto,
      bookingId,
      amount: paymentAmount,
      paymentType: 'remaining' as const,
      description: `Nhân viên xác nhận thanh toán phần còn lại cho booking ${bookingId}`,
    };

    const result = await paymentService.createPaymentUrl(paymentRequest);

    // Tạo notification cho guest
    await this.notificationsService.create({
      user_id: booking.guestId?.toString() || '',
      recipient_type: RecipientType.GUEST,
      type: NotificationType.PAYMENT,
      title: 'Xác nhận thanh toán',
      message: `Nhân viên đã xác nhận thanh toán phần còn lại ${paymentAmount.toLocaleString('vi-VN')}đ cho booking của bạn`,
      sent_method: [SentMethod.IN_APP],
      status: NotificationStatus.SENT,
      metadata: {
        bookingId: bookingId,
        propertyId: booking.propertyId?.toString(),
        listingId: booking.listingId?.toString(),
        amount: outstandingAmount,
        paymentType: 'remaining',
      },
    });

    return {
      success: result.success,
      paymentMethod: result.paymentMethod,
      paymentUrl: result.paymentUrl,
      orderId: result.orderId,
      amount: result.amount,
      message: result.message,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
    };
  }

  // =================== NOTE & ADDITIONAL COST METHODS ===================

  async updateNote(
    propertyId: string,
    bookingId: string,
    note: string,
    user: JwtPayload,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      _id: bookingId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Cập nhật note
    const updatedBooking = await this.bookingRepo.updateById(
      bookingId,
      {
        note,
      },
      user._id,
    );

    return this.transformBookingToResponse(updatedBooking);
  }

  async updateAdditionalCost(
    propertyId: string,
    bookingId: string,
    additionalCost: number,
    additionalCostReason?: string,
    user?: JwtPayload,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      _id: bookingId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Tính lại final_amount nếu có additionalCost
    let finalAmount = booking.final_amount;
    if (additionalCost !== booking.additionalCost) {
      finalAmount =
        booking.final_amount - (booking.additionalCost || 0) + additionalCost;
    }

    // Cập nhật additionalCost và final_amount
    const updateData: any = {
      additionalCost,
      final_amount: finalAmount,
    };

    if (additionalCostReason !== undefined) {
      updateData.additionalCostReason = additionalCostReason;
    }

    const updatedBooking = await this.bookingRepo.updateById(
      bookingId,
      updateData,
      user?._id,
    );

    return this.transformBookingToResponse(updatedBooking);
  }

  // =================== CANCELLATION DETAILS METHODS ===================

  async updateCancellationDetails(
    propertyId: string,
    bookingId: string,
    cancellationDetails: any,
    user: JwtPayload,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      _id: bookingId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    // Cập nhật cancellationDetails
    const updatedBooking = await this.bookingRepo.updateById(
      bookingId,
      {
        cancellationDetails,
        cancellationDetailsUpdatedAt: new Date(),
        cancellationDetailsUpdatedBy: new Types.ObjectId(user._id),
      },
      user._id,
    );

    return this.transformBookingToResponse(updatedBooking);
  }

  async getCancellationDetails(
    propertyId: string,
    bookingId: string,
  ): Promise<any> {
    const booking = await this.bookingRepo.findOne({
      _id: bookingId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }

    return {
      cancellationDetails: booking.cancellationDetails,
      cancellationDetailsUpdatedAt: booking.cancellationDetailsUpdatedAt,
      cancellationDetailsUpdatedBy: booking.cancellationDetailsUpdatedBy,
    };
  }

  // =================== STAFF BOOKING METHODS ===================

  async createStaffBooking(
    createBookingDto: StaffCreateBookingDto,
    user: JwtPayload,
  ): Promise<BookingResponseDto> {
    try {
      // Kiểm tra quyền staff
      if (user.role !== 'admin' && user.role !== 'staff') {
        throw new ForbiddenException(
          'Chỉ admin và staff mới có thể tạo booking',
        );
      }

      // Kiểm tra staff có được assign cho property này không
      if (user.role === 'staff') {
        const isAssigned =
          await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
            new Types.ObjectId(user._id),
            new Types.ObjectId(createBookingDto.propertyId),
          );
        if (!isAssigned) {
          throw new ForbiddenException(
            'Bạn không có quyền tạo booking cho property này',
          );
        }
      }

      // Lấy thông tin listing (staff có thể tạo booking cho listing ở bất kỳ trạng thái nào)
      const listing = await this.listingService.findOneForStaff(
        createBookingDto.listingId,
      );
      if (!listing) {
        throw new NotFoundException('Không tìm thấy listing');
      }

      // Kiểm tra availability nếu không skip
      if (!createBookingDto.skip_availability_check) {
        const availability = await this.checkAvailability(
          createBookingDto.listingId,
          createBookingDto.checkInDate,
          createBookingDto.checkOutDate,
        );
        if (!availability.available) {
          throw new BadRequestException(availability.message);
        }
      }

      // Tính toán các giá trị
      const checkInDate = new Date(createBookingDto.checkInDate);
      const checkOutDate = new Date(createBookingDto.checkOutDate);
      const nights = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Tính giá cơ bản
      const pricePerNight =
        createBookingDto.price_per_night || listing.price_per_night;
      const totalPrice = pricePerNight * nights;

      // Tính weekend surcharge từ listing
      let weekendSurcharge = 0;

      if (listing.has_weekend_surcharge) {
        const weekendDays = this.calculateWeekendDays(
          checkInDate,
          checkOutDate,
        );

        // Tính theo phần trăm
        const surchargePercent = listing.weekend_surcharge_percent || 0;
        weekendSurcharge =
          (pricePerNight * weekendDays * surchargePercent) / 100;
      }

      // Tính services
      let servicesTotalAmount = 0;
      const selectedServices: Array<{
        service_id: Types.ObjectId;
        service_name: string;
        service_price: number;
        quantity: number;
        total_price: number;
      }> = [];
      if (createBookingDto.services && createBookingDto.services.length > 0) {
        for (const serviceDto of createBookingDto.services) {
          const service = await this.servicesService.findOne(
            serviceDto.serviceId,
          );
          if (service) {
            const serviceTotal = service.default_price * serviceDto.quantity;
            servicesTotalAmount += serviceTotal;
            selectedServices.push({
              service_id: new Types.ObjectId(serviceDto.serviceId),
              service_name: service.name,
              service_price: service.default_price,
              quantity: serviceDto.quantity,
              total_price: serviceTotal,
            });
          }
        }
      }

      // Tính voucher discount
      let voucherDiscountAmount = 0;
      let voucherDiscountPercent = 0;
      let voucherId: any = null;
      let voucherCode: any = null;

      if (createBookingDto.voucherCode) {
        const voucher = await this.voucherService.findByCode(
          createBookingDto.voucherCode,
        );
        if (voucher) {
          voucherId = voucher._id;
          voucherCode = voucher.code;
          voucherDiscountPercent = voucher.discount_percent || 0;
          voucherDiscountAmount = 0; // Sẽ tính dựa trên discount_percent
        }
      }

      // Tính subtotal và discount
      const subtotalAmount =
        totalPrice + servicesTotalAmount + weekendSurcharge;
      const discountAmount =
        voucherDiscountAmount + (subtotalAmount * voucherDiscountPercent) / 100;
      const amountAfterDiscount = subtotalAmount - discountAmount;

      // Tính service fee và tax
      const serviceFee = amountAfterDiscount * 0.1; // 10%
      const taxAmount = amountAfterDiscount * 0.08; // 8%

      // Tính final amount
      const additionalCost = createBookingDto.additionalCost || 0;
      const finalAmount =
        amountAfterDiscount + serviceFee + taxAmount + additionalCost;

      // Tính commission và payout
      const commissionRate = 0.1; // 10%
      const finalPayoutAmount = finalAmount * (1 - commissionRate);

      // Tạo booking data
      const bookingData = {
        propertyId: new Types.ObjectId(createBookingDto.propertyId),
        listingId: new Types.ObjectId(createBookingDto.listingId),
        guestId: createBookingDto.guestId
          ? new Types.ObjectId(createBookingDto.guestId)
          : null,
        checkInDate,
        check_out_date: checkOutDate,
        guests: createBookingDto.guests,
        infants: createBookingDto.infants || 0,
        nights,
        price_per_night: pricePerNight,
        total_price: totalPrice,
        service_fee: serviceFee,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        commissionRate,
        finalPayoutAmount,
        status: createBookingDto.status || BookingStatus.PENDING,
        payment_status: createBookingDto.payment_status || PaymentStatus.UNPAID,
        guest_name: createBookingDto.guest_name,
        guest_email: createBookingDto.guest_email,
        guest_phone: createBookingDto.guest_phone,
        special_requests: createBookingDto.specialRequests,
        voucher_id: voucherId || null,
        voucher_code: voucherCode || null,
        voucher_discount_amount: voucherDiscountAmount,
        voucher_discount_percent: voucherDiscountPercent,
        selected_services: selectedServices,
        services_total_amount: servicesTotalAmount,
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        amount_after_discount: amountAfterDiscount,
        note: createBookingDto.note,
        additionalCost: additionalCost,
        additionalCostReason: createBookingDto.additionalCostReason,
        createdBy: new Types.ObjectId(user._id),
        updatedBy: new Types.ObjectId(user._id),
      };

      // Debug log before creating booking
      this.logger.log(
        'Creating booking with data:',
        JSON.stringify(bookingData, null, 2),
      );

      // Tạo booking
      const booking = await this.bookingRepo.create(bookingData, user._id);

      // Tạo notifications
      await this.createStaffNotifications(
        createBookingDto.propertyId,
        booking,
        { _id: listing._id as Types.ObjectId, title: listing.title },
        finalAmount,
      );

      return this.transformBookingToResponse(booking);
    } catch (error) {
      this.handleError(error, 'createStaffBooking');
    }
  }

  // Helper method để tính số ngày cuối tuần
  private calculateWeekendDays(checkInDate: Date, checkOutDate: Date): number {
    let weekendDays = 0;
    const currentDate = new Date(checkInDate);

    while (currentDate < checkOutDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // 0 = Sunday, 6 = Saturday
        weekendDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weekendDays;
  }

  // =================== PAYMENT STATUS METHODS ===================

  async getPaymentStatus(bookingId: string): Promise<PaymentStatusDto> {
    // Get booking info first to determine payment method
    const booking = await this.findOne(bookingId);
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

  /**
   * Tạo thông báo tóm tắt booking cho admin (có thể gọi định kỳ)
   */
  async createAdminBookingSummaryNotification(): Promise<void> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Đếm số booking mới trong ngày
      const todayBookings = await this.bookingRepo.getModel().countDocuments({
        created_at: { $gte: startOfDay, $lte: endOfDay },
      });

      // Tính tổng doanh thu trong ngày
      const revenueResult = await this.bookingRepo.getModel().aggregate([
        {
          $match: {
            created_at: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: BookingStatus.CANCELLED },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$final_amount' },
          },
        },
      ]);

      const totalRevenue = revenueResult[0]?.totalRevenue || 0;

      if (todayBookings > 0) {
        // Get all admin users
        const adminUsers = await this.bookingRepo
          .getModel()
          .db.collection('users')
          .find({ role: 'admin' })
          .toArray();

        // Create summary notification for each admin
        for (const admin of adminUsers) {
          await this.notificationsService.create({
            user_id: admin._id.toString(),
            recipient_type: RecipientType.ADMIN,
            title: `📈 Tóm tắt booking hôm nay`,
            message: `Hôm nay có ${todayBookings} booking mới với tổng doanh thu ${totalRevenue.toLocaleString('vi-VN')}đ. Kiểm tra chi tiết để theo dõi hiệu suất.`,
            type: NotificationType.SYSTEM,
            status: NotificationStatus.SENT,
            sent_method: [SentMethod.IN_APP],
            metadata: {
              summaryType: 'daily_booking',
              date: startOfDay,
              totalBookings: todayBookings,
              totalRevenue,
            },
          });
        }

        this.logger.log(
          `Created daily booking summary notification: ${todayBookings} bookings, ${totalRevenue}đ revenue`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error creating admin booking summary notification:',
        error,
      );
    }
  }

  /**
   * Lấy danh sách booking đang sử dụng voucher cụ thể
   */
  async getBookingsByVoucher(
    voucherId: string,
    queryDto: QueryBookingDto,
    user?: JwtPayload,
    request?: any,
  ): Promise<PaginatedBookings> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;

    // Tạo filter cơ bản
    const baseFilter: any = {
      voucher_id: new Types.ObjectId(voucherId),
    };

    // Thêm staff filter nếu cần
    if (user && user.role === 'staff' && request?.staffPropertyIds) {
      console.log('🔍 Staff filter applied for getBookingsByVoucher:', {
        userId: user._id,
        staffPropertyIds: request.staffPropertyIds,
      });
      baseFilter.propertyId = {
        $in: request.staffPropertyIds.map((id) => new Types.ObjectId(id)),
      };
    }

    console.log('📋 Final baseFilter for getBookingsByVoucher:', baseFilter);

    // Thêm các filter khác từ queryDto
    if (queryDto.status) {
      baseFilter.status = queryDto.status;
    }
    if (queryDto.propertyId) {
      baseFilter.propertyId = new Types.ObjectId(queryDto.propertyId);
    }
    if (queryDto.listingId) {
      baseFilter.listingId = new Types.ObjectId(queryDto.listingId);
    }
    if (queryDto.checkInFrom && queryDto.checkInTo) {
      baseFilter.checkInDate = {
        $gte: new Date(queryDto.checkInFrom),
        $lte: new Date(queryDto.checkInTo),
      };
    }

    // Thực hiện aggregation
    const pipeline: any[] = [
      { $match: baseFilter },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property',
        },
      },
      { $unwind: '$property' },
      {
        $lookup: {
          from: 'listings',
          localField: 'listingId',
          foreignField: '_id',
          as: 'listing',
        },
      },
      { $unwind: '$listing' },
      {
        $project: {
          _id: 1,
          guest_name: 1,
          guest_email: 1,
          property_name: '$property.name',
          listing_title: '$listing.title',
          checkInDate: 1,
          checkOutDate: 1,
          voucher_discount_amount: 1,
          booking_status: '$status',
          created_at: 1,
          propertyId: 1,
          listingId: 1,
          original_price: '$total_amount',
          final_price: '$final_amount',
          nights: 1,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await this.bookingRepo.getModel().aggregate(pipeline);
    const bookings = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      data: bookings.map((booking) => ({
        ...booking,
        _id: booking._id.toString(),
        propertyId: booking.propertyId.toString(),
        listingId: booking.listingId.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // =================== CALENDAR MANAGEMENT ===================

  /**
   * Lấy dữ liệu calendar theo ngày với thông tin booking chi tiết
   */
  async getCalendarData(
    queryDto: CalendarQueryDto,
    user: JwtPayload,
    request?: any,
  ): Promise<CalendarResponseDto> {
    // Xác định khoảng thời gian
    const startDate = queryDto.startDate
      ? new Date(queryDto.startDate)
      : new Date();
    const endDate = queryDto.endDate ? new Date(queryDto.endDate) : new Date();

    if (queryDto.viewType === CalendarViewType.MONTHLY) {
      // Nếu không có startDate, lấy tháng hiện tại
      if (!queryDto.startDate) {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      }
      // Nếu không có endDate, lấy cuối tháng
      if (!queryDto.endDate) {
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (queryDto.viewType === CalendarViewType.WEEKLY) {
      // Nếu không có startDate, lấy tuần hiện tại
      if (!queryDto.startDate) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
      }
      // Nếu không có endDate, lấy cuối tuần
      if (!queryDto.endDate) {
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // DAILY view
      if (!queryDto.startDate) {
        startDate.setHours(0, 0, 0, 0);
      }
      if (!queryDto.endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
    }

    // Tạo filter cho booking
    const filter: any = {
      isDeleted: false,
      checkInDate: { $lte: endDate },
      check_out_date: { $gte: startDate },
    };

    // Filter theo property nếu có
    if (queryDto.propertyId) {
      filter.propertyId = new Types.ObjectId(queryDto.propertyId);
    }

    // Filter theo listing nếu có
    if (queryDto.listingId) {
      filter.listingId = new Types.ObjectId(queryDto.listingId);
    }

    // Filter theo status nếu có
    if (queryDto.status) {
      filter.status = queryDto.status;
    }

    // Filter theo payment_status nếu có
    if (queryDto.payment_status) {
      filter.payment_status = queryDto.payment_status;
    }

    // Áp dụng staff filter nếu cần
    if (user.role === 'staff') {
      // Staff filtering sẽ được handle bởi interceptor
      // Không cần thêm logic ở đây vì đã có @StaffFiltered decorator
    }

    // Apply staff filtering using utility function
    const filteredQuery = applyStaffFilter(filter, request, 'propertyId');

    // Lấy tất cả bookings trong khoảng thời gian
    const { data: bookings } = await this.bookingRepo.findAll(filteredQuery, {
      limit: 0, // Không giới hạn
      populate: [
        { path: 'listingId', select: 'title' },
        { path: 'propertyId', select: 'name' },
      ],
    });

    // Tạo calendar days
    const days: CalendarDayDto[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
      });
      const isToday = currentDate.getTime() === today.getTime();
      const isWeekend =
        currentDate.getDay() === 0 || currentDate.getDay() === 6;

      // Tìm bookings cho ngày này
      const dayBookings: CalendarBookingDto[] = bookings
        .filter((booking) => {
          const bookingStart = new Date(booking.checkInDate);
          const bookingEnd = new Date(booking.check_out_date);
          const currentDay = new Date(currentDate);
          currentDay.setHours(0, 0, 0, 0);

          return bookingStart <= currentDay && bookingEnd > currentDay;
        })
        .map((booking) => ({
          _id: (booking._id as any).toString(),
          guest_name: booking.guest_name,
          guest_email: booking.guest_email,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.check_out_date,
          guests: booking.guests,
          status: booking.status,
          payment_status: booking.payment_status,
          final_amount: booking.final_amount,
          listing_title: (booking.listingId as any)?.title || 'N/A',
          property_name: (booking.propertyId as any)?.name || 'N/A',
          note: booking.note,
          additionalCost: booking.additionalCost,
        }));

      days.push({
        date: dateStr,
        dayOfWeek,
        isToday,
        isWeekend,
        bookings: dayBookings,
        totalBookings: dayBookings.length,
        totalRevenue: dayBookings.reduce(
          (sum, booking) => sum + (booking.final_amount || 0),
          0,
        ),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Tính toán tổng quan
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + (booking.final_amount || 0),
      0,
    );
    const averageOccupancy =
      days.length > 0
        ? days.reduce((sum, day) => sum + day.totalBookings, 0) / days.length
        : 0;

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      viewType: queryDto.viewType || CalendarViewType.MONTHLY,
      days,
      totalBookings,
      totalRevenue,
      averageOccupancy,
    };
  }

  /**
   * Lấy danh sách booking đang sử dụng service cụ thể
   */
  async getBookingsByService(
    serviceId: string,
    queryDto: QueryBookingDto,
    user?: JwtPayload,
    request?: any,
  ): Promise<PaginatedBookings> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = queryDto;
    const skip = (page - 1) * limit;

    // Tạo filter cơ bản
    const baseFilter: any = {
      'selected_services.service_id': new Types.ObjectId(serviceId),
    };

    // Thêm staff filter nếu cần
    if (user && user.role === 'staff' && request?.staffPropertyIds) {
      console.log('🔍 Staff filter applied for getBookingsByService:', {
        userId: user._id,
        staffPropertyIds: request.staffPropertyIds,
      });
      baseFilter.propertyId = {
        $in: request.staffPropertyIds.map((id) => new Types.ObjectId(id)),
      };
    }

    console.log('📋 Final baseFilter for getBookingsByService:', baseFilter);

    // Thêm các filter khác từ queryDto
    if (queryDto.status) {
      baseFilter.status = queryDto.status;
    }
    if (queryDto.propertyId) {
      baseFilter.propertyId = new Types.ObjectId(queryDto.propertyId);
    }
    if (queryDto.listingId) {
      baseFilter.listingId = new Types.ObjectId(queryDto.listingId);
    }
    if (queryDto.checkInFrom && queryDto.checkInTo) {
      baseFilter.checkInDate = {
        $gte: new Date(queryDto.checkInFrom),
        $lte: new Date(queryDto.checkInTo),
      };
    }

    // Thực hiện aggregation
    const pipeline: any[] = [
      { $match: baseFilter },
      {
        $addFields: {
          serviceInfo: {
            $filter: {
              input: '$selected_services',
              as: 'service',
              cond: {
                $eq: ['$$service.service_id', new Types.ObjectId(serviceId)],
              },
            },
          },
        },
      },
      { $unwind: '$serviceInfo' },
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property',
        },
      },
      { $unwind: '$property' },
      {
        $lookup: {
          from: 'listings',
          localField: 'listingId',
          foreignField: '_id',
          as: 'listing',
        },
      },
      { $unwind: '$listing' },
      {
        $project: {
          _id: 1,
          guest_name: 1,
          guest_email: 1,
          property_name: '$property.name',
          listing_title: '$listing.title',
          checkInDate: 1,
          checkOutDate: 1,
          service_quantity: '$serviceInfo.quantity',
          service_total_price: '$serviceInfo.total_price',
          booking_status: '$status',
          created_at: 1,
          propertyId: 1,
          listingId: 1,
          original_price: '$total_amount',
          final_price: '$final_amount',
          nights: 1,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await this.bookingRepo.getModel().aggregate(pipeline);
    const bookings = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      data: bookings.map((booking) => ({
        ...booking,
        _id: booking._id.toString(),
        propertyId: booking.propertyId.toString(),
        listingId: booking.listingId.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy thông tin booking chi tiết cho một ngày cụ thể
   */
  async getDayBookings(
    date: string,
    propertyId?: string,
    listingId?: string,
    user?: JwtPayload,
    request?: any,
  ): Promise<CalendarDayDto> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const filter: any = {
      isDeleted: false,
      checkInDate: { $lt: nextDate },
      check_out_date: { $gte: targetDate },
    };

    if (propertyId) {
      filter.propertyId = new Types.ObjectId(propertyId);
    }

    if (listingId) {
      filter.listingId = new Types.ObjectId(listingId);
    }

    // Áp dụng staff filter nếu cần
    if (user && user.role === 'staff') {
      // Staff filtering sẽ được handle bởi interceptor
      // Không cần thêm logic ở đây vì đã có @StaffFiltered decorator
    }

    // Apply staff filtering using utility function
    const filteredQuery = applyStaffFilter(filter, request, 'propertyId');

    const { data: bookings } = await this.bookingRepo.findAll(filteredQuery, {
      limit: 0,
      populate: [
        { path: 'listingId', select: 'title' },
        { path: 'propertyId', select: 'name' },
      ],
    });

    const dayOfWeek = targetDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = targetDate.getTime() === today.getTime();
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;

    const dayBookings: CalendarBookingDto[] = bookings.map((booking) => ({
      _id: (booking._id as any).toString(),
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.check_out_date,
      guests: booking.guests,
      status: booking.status,
      payment_status: booking.payment_status,
      final_amount: booking.final_amount,
      listing_title: (booking.listingId as any)?.title,
      property_name: (booking.propertyId as any)?.name,
      note: booking.note,
      additionalCost: booking.additionalCost,
    }));

    const totalBookings = dayBookings.length;
    const totalRevenue = dayBookings.reduce(
      (sum, booking) => sum + booking.final_amount,
      0,
    );

    return {
      date,
      dayOfWeek,
      isToday,
      isWeekend,
      bookings: dayBookings,
      totalBookings,
      totalRevenue,
    };
  }
}
