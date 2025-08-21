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
import { FilterQuery, Types, SortOrder, Model } from 'mongoose';
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
import { BookingNotificationService } from './services/booking-notification.service';
import { BookingNotificationStatusService } from './services/booking-notification-status.service';

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
  PaymentStatusStatistics,
  BookingFinancialStatistics,
  BookingCustomerStatistics,
  BookingTimelineStatistics,
  BookingChartDataPoint,
  BookingDetailDto,
} from './dto/booking-statistics.dto';
import { getGroupFormat, generateLabels } from '../../utils/date.util';
import {
  CancelPolicy,
  Listing,
  ListingStatus,
} from '../listing/schemas/listing.schema';
import { InjectModel } from '@nestjs/mongoose';
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
import {
  BookingStatisticsQueryDto,
  DateRangeType,
} from './dto/booking-statistics.dto';
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
    @InjectModel(Listing.name) private readonly listingModel: Model<Listing>,
    private readonly bookingNotificationService: BookingNotificationService,
    private readonly bookingNotificationStatusService: BookingNotificationStatusService,
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Transform booking data thành response format
   */
  private async transformBookingToResponse(
    booking: any,
  ): Promise<BookingResponseDto> {
    // Handle guestId: can be ObjectId or populated object
    let guestId: string = '';
    let guest_name: string | undefined = undefined;
    let guest_email: string | undefined = undefined;
    let guest_phone: string | undefined = undefined;

    if (booking.guestId) {
      if (typeof booking.guestId === 'object' && booking.guestId._id) {
        // Nếu có guestId object (populated) → lấy từ guest object
        guestId = booking.guestId._id.toString();
        guest_name = booking.guestId.name;
        guest_email = booking.guestId.email;
        guest_phone = booking.guestId.phone;
      } else {
        // Nếu có guestId string → lấy từ booking fields
        guestId = booking.guestId.toString();
        guest_name = booking.guest_name;
        guest_email = booking.guest_email;
        guest_phone = booking.guest_phone;
      }
    } else {
      // Nếu không có guestId (null/undefined) → lấy từ booking fields
      guest_name = booking.guest_name;
      guest_email = booking.guest_email;
      guest_phone = booking.guest_phone;
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
      selected_services: await Promise.all(
        booking.selected_services?.map(async (service: any) => {
          // Lấy thông tin service để có allow_quantity
          let allow_quantity = false;
          try {
            const serviceDetails = await this.servicesService.findOne(
              service.service_id.toString(),
            );
            allow_quantity = serviceDetails?.allow_quantity || false;
          } catch (error) {
            // Nếu không tìm thấy service, giữ allow_quantity = false
            this.logger.warn(`Service not found: ${service.service_id}`, error);
          }

          return {
            service_id: service.service_id
              ? service.service_id.toString()
              : null,
            service_name: service.service_name,
            service_price: service.service_price,
            quantity: service.quantity,
            total_price: service.total_price,
            allow_quantity,
          };
        }) || [],
      ),
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

        // Kiểm tra xem service có cho phép nhập số lượng hay không
        let finalQuantity = serviceDto.quantity;
        if (!service.allow_quantity) {
          // Nếu service không cho phép quantity, force về 1 và validate
          if (serviceDto.quantity > 1) {
            throw new BadRequestException(
              `Dịch vụ "${service.name}" không cho phép chọn số lượng. Chỉ có thể chọn 1 lần.`,
            );
          }
          finalQuantity = 1;
        }

        const serviceTotalPrice = service.default_price * finalQuantity;
        servicesTotalAmount += serviceTotalPrice;

        selectedServices.push({
          service_id: new Types.ObjectId(serviceDto.serviceId),
          service_name: service.name,
          service_price: service.default_price,
          quantity: finalQuantity,
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
      await this.bookingNotificationService.createGuestNewBookingNotification(
        createdBooking,
        populatedListing,
        finalAmount,
        user,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create guest notification for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
    }

    // Tạo thông báo in-app cho staff (không cần email)
    try {
      // Tạo thông báo in-app cho staff
      await this.bookingNotificationService.createStaffNewBookingNotification(
        propertyId.toString(),
        createdBooking,
        populatedListing,
        finalAmount,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create staff notifications for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
      // Không throw error để không ảnh hưởng đến việc tạo booking
    }

    // Tạo thông báo cho admin (có thể tùy chọn bỏ qua)
    try {
      await this.bookingNotificationService.createAdminNewBookingNotification(
        createdBooking,
        populatedListing,
        finalAmount,
        // Có thể thêm option để bỏ qua thông báo admin nếu cần
        // { skipAdminNotification: true }
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin notifications for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
      // Không throw error để không ảnh hưởng đến việc tạo booking
    }

    return await this.transformBookingToResponse(createdBooking);
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

    return await this.transformBookingToResponse(booking);
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

        // Kiểm tra xem service có cho phép nhập số lượng hay không
        let finalQuantity = serviceDto.quantity;
        if (!service.allow_quantity) {
          // Nếu service không cho phép quantity, force về 1 và validate
          if (serviceDto.quantity > 1) {
            throw new BadRequestException(
              `Dịch vụ "${service.name}" không cho phép chọn số lượng. Chỉ có thể chọn 1 lần.`,
            );
          }
          finalQuantity = 1;
        }

        const totalPrice = service.default_price * finalQuantity;
        totalServicesAmount += totalPrice;

        processedServices.push({
          service_id: new Types.ObjectId(serviceDto.serviceId),
          service_name: service.name,
          service_price: service.default_price,
          quantity: finalQuantity,
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
    const originalPaymentStatus = booking.payment_status;
    const newPaymentStatus = updated.payment_status;

    if (originalStatus !== newStatus) {
      try {
        await this.bookingNotificationStatusService.createStatusChangeNotification(
          updated,
          newStatus,
        );
      } catch (error) {
        this.logger.error(
          `[UPDATE] Failed to create status change notifications for booking ${id}:`,
          error,
        );
        // Don't throw - continue with response
      }
    }

    // Check if payment status changed and create payment notifications
    if (originalPaymentStatus !== newPaymentStatus) {
      try {
        await this.bookingNotificationStatusService.createPaymentStatusChangeNotification(
          updated,
          originalPaymentStatus,
          newPaymentStatus,
        );
      } catch (error) {
        this.logger.error(
          `[UPDATE] Failed to create payment status change notifications for booking ${id}:`,
          error,
        );
        // Don't throw - continue with response
      }
    }

    // 6. Trả về booking + outstanding_amount
    const result = await this.transformBookingToResponse(updated);
    (result as any).outstanding_amount =
      (result.final_amount || 0) - (updated.deposit_paid_amount || 0);
    return result;
  }

  /**
   * Xóa mềm booking và trả về dữ liệu định dạng (Admin/Staff cancellation)
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
      await this.bookingNotificationStatusService.createStatusChangeNotification(
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
    await this.bookingNotificationStatusService.createStatusChangeNotification(
      booking,
      status,
    );

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
      [sortBy || 'created_at']: sortOrder === 'asc' ? 1 : -1,
    };

    const hasNameFilters = Boolean(
      (filters as any).keyword ||
        (filters as any).guestName ||
        (filters as any).listingTitle ||
        (filters as any).propertyName,
    );

    if (!hasNameFilters) {
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
        data: await Promise.all(
          data.map((booking) => this.transformBookingToResponse(booking)),
        ),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      };
    }

    // Name-based search via aggregation (guest, listing, property)
    const pipeline: any[] = [
      { $match: filteredQuery },
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
        $lookup: {
          from: 'users',
          localField: 'guestId',
          foreignField: '_id',
          as: 'guest',
        },
      },
      { $unwind: { path: '$guest', preserveNullAndEmptyArrays: true } },
    ];

    const andConditions: any[] = [];
    if (
      (filters as any).keyword &&
      typeof (filters as any).keyword === 'string'
    ) {
      const regex = new RegExp((filters as any).keyword, 'i');
      andConditions.push({
        $or: [
          { guest_name: regex },
          { 'guest.name': regex },
          { 'listing.title': regex },
          { 'property.name': regex },
        ],
      });
    }
    if ((filters as any).guestName) {
      const regex = new RegExp(String((filters as any).guestName), 'i');
      andConditions.push({
        $or: [{ guest_name: regex }, { 'guest.name': regex }],
      });
    }
    if ((filters as any).listingTitle) {
      const regex = new RegExp(String((filters as any).listingTitle), 'i');
      andConditions.push({ 'listing.title': regex });
    }
    if ((filters as any).propertyName) {
      const regex = new RegExp(String((filters as any).propertyName), 'i');
      andConditions.push({ 'property.name': regex });
    }

    if (andConditions.length > 0) {
      pipeline.push({ $match: { $and: andConditions } });
    }

    const countPipeline = [
      ...pipeline.filter(
        (stg) => !('$skip' in stg || '$limit' in stg || '$sort' in stg),
      ),
      { $count: 'total' },
    ];

    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          propertyId: {
            _id: '$property._id',
            name: '$property.name',
            location: '$property.location',
          },
          listingId: {
            _id: '$listing._id',
            title: '$listing.title',
            images: '$listing.images',
            address: '$listing.address',
            price_per_night: '$listing.price_per_night',
            cancel_policy: '$listing.cancel_policy',
          },
          guestId: 1,
          checkInDate: 1,
          check_out_date: 1,
          guests: 1,
          infants: 1,
          nights: 1,
          price_per_night: 1,
          total_price: 1,
          selected_services: 1,
          services_total_amount: 1,
          subtotal_amount: 1,
          voucher_id: 1,
          voucher_code: 1,
          voucher_discount_amount: 1,
          voucher_discount_percent: 1,
          discount_amount: 1,
          amount_after_discount: 1,
          service_fee: 1,
          tax_amount: 1,
          final_amount: 1,
          commissionRate: 1,
          finalPayoutAmount: 1,
          status: 1,
          payment_status: 1,
          payment_method: 1,
          vnpay_order_id: 1,
          momo_order_id: 1,
          guest_name: { $ifNull: ['$guest.name', '$guest_name'] },
          guest_email: { $ifNull: ['$guest.email', '$guest_email'] },
          guest_phone: { $ifNull: ['$guest.phone', '$guest_phone'] },
          special_requests: 1,
          created_at: 1,
          updated_at: 1,
          note: 1,
          additionalCost: 1,
          additionalCostReason: 1,
        },
      },
    );

    const [items, countArr] = await Promise.all([
      this.bookingRepo.getModel().aggregate(pipeline),
      this.bookingRepo.getModel().aggregate(countPipeline),
    ]);

    const total = countArr?.[0]?.total || 0;

    return {
      data: await Promise.all(
        items.map((booking: any) => this.transformBookingToResponse(booking)),
      ),
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
   * Kiểm tra xem có booking nào khác đã thanh toán cho cùng khoảng thời gian không
   */
  async checkBookingConflictForDates(
    listingId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeBookingId?: string,
  ) {
    const query: FilterQuery<Booking> = {
      listingId: new Types.ObjectId(listingId),
      payment_status: { $in: ['paid', 'partially_paid'] },
      isDeleted: false,
      $and: [
        {
          checkInDate: { $lt: new Date(checkOutDate) },
        },
        {
          check_out_date: { $gt: new Date(checkInDate) },
        },
      ],
    };

    // Loại trừ booking hiện tại nếu có
    if (excludeBookingId) {
      query._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }

    console.log('🔍 checkBookingConflictForDates query:', {
      listingId,
      checkInDate,
      checkOutDate,
      excludeBookingId,
      query: JSON.stringify(query, null, 2),
    });

    const { data } = await this.bookingRepo.findAll(query);

    console.log('🔍 checkBookingConflictForDates result:', {
      hasConflict: data.length > 0,
      conflictingBookingsCount: data.length,
      conflictingBookings: data.map((booking) => ({
        _id: booking._id,
        checkInDate: booking.checkInDate,
        check_out_date: booking.check_out_date,
        payment_status: booking.payment_status,
        status: booking.status,
      })),
    });

    return {
      hasConflict: data.length > 0,
      conflictingBookings: data.map((booking) => ({
        _id: booking._id,
        checkInDate: booking.checkInDate,
        check_out_date: booking.check_out_date,
        payment_status: booking.payment_status,
        status: booking.status,
      })),
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
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeDeleted = false,
      ...filters
    } = queryDto;

    // Đảm bảo limit có giá trị hợp lệ
    const limit = queryDto.limit || 10;

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
      const page = queryDto.page || 1;
      const limit = queryDto.limit || 10;
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
    await this.bookingNotificationStatusService.createStatusChangeNotification(
      booking,
      BookingStatus.CANCELLED,
    );

    return {
      success: true,
      message: `Hủy booking thành công. Số tiền hoàn lại: ${refund_amount}`,
    };
  }

  async cancelBookingAsAdmin(
    id: string,
    adminUser: JwtPayload,
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
      booking.cancellationDetailsUpdatedBy = new Types.ObjectId(adminUser._id);
    } else {
      booking.cancellation_reason = `Admin ${adminUser.email} cancelled`;
    }

    // 4. Tính toán hoàn tiền theo chính sách
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

    // 5. Create status change notifications
    await this.bookingNotificationStatusService.createStatusChangeNotification(
      booking,
      BookingStatus.CANCELLED,
    );

    return {
      success: true,
      message: `Admin hủy booking thành công. Số tiền hoàn lại: ${refund_amount}`,
      refund_amount,
      cancellationDetails: booking.cancellationDetails,
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
   * Tạo filter cho thống kê với hỗ trợ nhiều property (cho staff)
   */
  private createStatisticsFilterWithMultipleProperties(
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
      // Handle comma-separated property IDs for staff
      if (propertyId.includes(',')) {
        const propertyIds = propertyId
          .split(',')
          .map((id) => new Types.ObjectId(id.trim()));
        filter.propertyId = { $in: propertyIds };
      } else {
        filter.propertyId = new Types.ObjectId(propertyId);
      }
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
    queryDto: BookingStatisticsQueryDto,
    user?: JwtPayload,
  ): Promise<
    BookingOverviewStatistics & {
      statusBreakdown: BookingStatusStatistics;
      paymentStatusBreakdown: PaymentStatusStatistics;
      chartData: BookingChartDataPoint[];
    }
  > {
    // Check staff access if user is staff
    if (user && user.role === 'staff') {
      const assignments =
        await this.propertyStaffAssignmentService.getPropertiesByStaff(
          new Types.ObjectId(user._id),
        );

      const staffPropertyIds = assignments.map((assignment: any) => {
        // Handle both populated and unpopulated propertyId
        if (
          typeof assignment.propertyId === 'object' &&
          assignment.propertyId?._id
        ) {
          return assignment.propertyId._id.toString();
        }

        // Handle case where propertyId is a string containing object representation
        if (
          typeof assignment.propertyId === 'string' &&
          assignment.propertyId.includes('ObjectId(')
        ) {
          const match = assignment.propertyId.match(/ObjectId\('([^']+)'\)/);
          if (match) {
            return match[1];
          }
        }

        // If propertyId is already a string or ObjectId
        return assignment.propertyId.toString();
      });

      // If propertyId is specified in query, check if staff has access
      if (queryDto.propertyId) {
        // Handle comma-separated property IDs
        const requestedPropertyIds = queryDto.propertyId.includes(',')
          ? queryDto.propertyId.split(',').map((id) => id.trim())
          : [queryDto.propertyId];

        // Check if all requested property IDs are in staff's assigned properties
        const hasAccess = requestedPropertyIds.every((requestedId) =>
          staffPropertyIds.includes(requestedId),
        );

        if (!hasAccess) {
          throw new ForbiddenException(
            'Staff không có quyền xem thống kê của property này',
          );
        }
      }

      // If no propertyId specified, filter to only staff's assigned properties
      if (!queryDto.propertyId) {
        queryDto.propertyId = staffPropertyIds.join(',');
      }
    }

    // Get date range from query
    const { startDate, endDate } = this.getDateRangeFromQuery(queryDto);

    // Tạo filter cho thống kê chính (sử dụng cùng khoảng thời gian)
    const filter = this.createStatisticsFilterWithMultipleProperties(
      startDate.toISOString(),
      endDate.toISOString(),
      queryDto.propertyId,
      queryDto.listingId,
    );

    // Force daily grouping to always return full 30-day (or selected range) series by day
    const finalGroupBy = 'day';
    const { format: groupFormat } = getGroupFormat(finalGroupBy);

    // Lấy dữ liệu cho biểu đồ (sử dụng cùng khoảng thời gian)
    const chartMatch: any = { ...filter };

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

    const labels = generateLabels(startDate, endDate, finalGroupBy);

    const chartData: BookingChartDataPoint[] = labels.map((label) => {
      const data = labelMap.get(label) || {
        revenue: 0,
        bookings: 0,
        nights: 0,
      };
      return {
        // Keep label as raw YYYY-MM-DD string to match dashboard format
        label: String(label),
        revenue: data.revenue,
        bookings: data.bookings,
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
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    // Tổng số đêm có thể bán = số ngày trong kỳ x số listing hoạt động trong phạm vi lọc
    let totalPossibleNights = 0;
    if (queryDto.listingId) {
      const activeOneListing = await this.listingModel.countDocuments({
        _id: new Types.ObjectId(queryDto.listingId),
        status: ListingStatus.ACTIVE,
      });
      totalPossibleNights = daysInPeriod * activeOneListing;
    } else if (queryDto.propertyId) {
      const propertyIds = queryDto.propertyId.includes(',')
        ? queryDto.propertyId
            .split(',')
            .map((id) => new Types.ObjectId(id.trim()))
        : [new Types.ObjectId(queryDto.propertyId)];
      const activeListingsCount = await this.listingModel.countDocuments({
        propertyId: { $in: propertyIds },
        status: ListingStatus.ACTIVE,
      });
      totalPossibleNights = daysInPeriod * activeListingsCount;
    } else {
      // Admin xem tất cả listings hoạt động
      const activeListingsCount = await this.listingModel.countDocuments({
        status: ListingStatus.ACTIVE,
      });
      totalPossibleNights = daysInPeriod * activeListingsCount;
    }

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

    // Thống kê theo trạng thái thanh toán
    const paymentStatusStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$payment_status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Tạo object trạng thái thanh toán
    const paymentStatusBreakdown: PaymentStatusStatistics = {
      unpaid: 0,
      partially_paid: 0,
      paid: 0,
      refunding: 0,
      refunded: 0,
      failed: 0,
    };

    paymentStatusStats.forEach(
      (stat: { _id: keyof PaymentStatusStatistics; count: number }) => {
        if (stat._id in paymentStatusBreakdown) {
          paymentStatusBreakdown[stat._id] = stat.count;
        }
      },
    );

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
          totalVoucherDiscountPercent: { $sum: '$voucher_discount_percent' },
          averageVoucherDiscountPercent: { $avg: '$voucher_discount_percent' },
        },
      },
    ]);

    const voucherData = voucherStats[0] || {
      totalVouchersUsed: 0,
      totalVoucherDiscount: 0,
      averageVoucherDiscount: 0,
      totalVoucherDiscountPercent: 0,
      averageVoucherDiscountPercent: 0,
    };

    // Thống kê chi tiết voucher theo mã
    const voucherBreakdown = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      { $match: { voucher_id: { $ne: null } } },
      {
        $group: {
          _id: '$voucher_code',
          voucherId: { $first: '$voucher_id' },
          usageCount: { $sum: 1 },
          averageDiscountPercent: { $avg: '$voucher_discount_percent' },
          discountPercent: { $first: '$voucher_discount_percent' },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
    ]);

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

    // Tính tỉ lệ lấp đầy theo unique room-night, checkOut exclusive, chỉ tính confirmed/completed
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const endExclusive = new Date(endOfDay.getTime() + dayMs);

    const occupancyMatch: any = {
      isDeleted: false,
      status: { $in: ['confirmed', 'completed'] },
      checkInDate: { $lt: endExclusive },
      check_out_date: { $gt: startOfDay },
    };
    if (queryDto.listingId) {
      occupancyMatch.listingId = new Types.ObjectId(queryDto.listingId);
    } else if (queryDto.propertyId) {
      if (queryDto.propertyId.includes(',')) {
        occupancyMatch.propertyId = {
          $in: queryDto.propertyId
            .split(',')
            .map((id) => new Types.ObjectId(id.trim())),
        };
      } else {
        occupancyMatch.propertyId = new Types.ObjectId(queryDto.propertyId);
      }
    }

    const occupancyDocs = await this.bookingRepo
      .getModel()
      .find(occupancyMatch, {
        listingId: 1,
        checkInDate: 1,
        check_out_date: 1,
      })
      .lean();

    const uniqueRoomNights = new Set<string>();
    occupancyDocs.forEach((b: any) => {
      const bStart = new Date(b.checkInDate);
      const bEndExclusive = new Date(b.check_out_date);
      const overlapStart = new Date(
        Math.max(bStart.getTime(), startOfDay.getTime()),
      );
      const overlapEndExclusive = new Date(
        Math.min(bEndExclusive.getTime(), endExclusive.getTime()),
      );
      for (
        let d = new Date(overlapStart);
        d < overlapEndExclusive;
        d = new Date(d.getTime() + dayMs)
      ) {
        const dateStr = d.toISOString().split('T')[0];
        uniqueRoomNights.add(`${b.listingId.toString()}::${dateStr}`);
      }
    });

    const totalRoomNightsBooked = uniqueRoomNights.size;
    const averageOccupancyRate =
      totalPossibleNights > 0
        ? Math.min(100, (totalRoomNightsBooked / totalPossibleNights) * 100)
        : 0;

    return {
      totalBookings: overview.totalBookings,
      totalRevenue: overview.totalRevenue,
      totalNights: overview.totalNights,
      averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
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
      totalVoucherDiscountPercent: voucherData.totalVoucherDiscountPercent,
      averageVoucherDiscountPercent: Math.round(
        voucherData.averageVoucherDiscountPercent || 0,
      ),
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
      topVouchersUsed: voucherBreakdown.map((voucher: any) => ({
        voucherId: voucher.voucherId?.toString() || 'Unknown',
        voucherCode: voucher._id || 'Unknown',
        usageCount: voucher.usageCount,
        averageDiscountPercent: Math.round(voucher.averageDiscountPercent || 0),
        discountPercent: Math.round(voucher.discountPercent || 0),
      })),
      statusBreakdown,
      paymentStatusBreakdown,
      chartData,
      bookingDetails: await this.getBookingDetails(filter),
    };
  }

  /**
   * Lấy thông tin chi tiết booking theo filter
   */
  private async getBookingDetails(filter: any): Promise<BookingDetailDto[]> {
    const bookings = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
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
          propertyId: '$property._id',
          property_name: '$property.name',
          listingId: '$listing._id',
          listing_title: '$listing.title',
          listing_images: '$listing.images',
          checkInDate: 1,
          check_out_date: 1,
          guests: 1,
          infants: 1,
          nights: 1,
          final_amount: 1,
          status: 1,
          payment_status: 1,
          created_at: 1,
          note: 1,
          additionalCost: 1,
        },
      },
      { $sort: { created_at: -1 } },
    ]);

    return bookings.map((booking) => ({
      _id: booking._id.toString(),
      guest_name: booking.guest_name || 'N/A',
      guest_email: booking.guest_email || 'N/A',
      propertyId: booking.propertyId.toString(),
      property_name: booking.property_name || 'N/A',
      listingId: booking.listingId.toString(),
      listing_title: booking.listing_title || 'N/A',
      listing_images: booking.listing_images || [],
      checkInDate: booking.checkInDate,
      check_out_date: booking.check_out_date,
      guests: booking.guests || 0,
      infants: booking.infants || 0,
      nights: booking.nights || 0,
      final_amount: booking.final_amount || 0,
      status: booking.status,
      payment_status: booking.payment_status,
      created_at: booking.created_at,
      note: booking.note,
      additionalCost: booking.additionalCost || 0,
    }));
  }

  /**
   * Helper method to get date range from query DTO (similar to listings service)
   */
  private getDateRangeFromQuery(queryDto: BookingStatisticsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    switch (queryDto.dateRange) {
      case DateRangeType.TODAY:
        return {
          startDate: today,
          endDate: todayEnd,
        };

      case DateRangeType.LAST_7_DAYS: {
        const sevenDaysAgo = new Date(
          today.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: sevenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_15_DAYS: {
        const fifteenDaysAgo = new Date(
          today.getTime() - 15 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: fifteenDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.LAST_30_DAYS: {
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };
      }

      case DateRangeType.CUSTOM: {
        if (queryDto.startDate && queryDto.endDate) {
          return {
            startDate: new Date(queryDto.startDate + 'T00:00:00.000Z'),
            endDate: new Date(queryDto.endDate + 'T23:59:59.999Z'),
          };
        }
        // Fall back to last 30 days if custom dates are not provided
        const thirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: thirtyDaysAgo,
          endDate: todayEnd,
        };
      }

      default: {
        // Default to last 30 days
        const defaultThirtyDaysAgo = new Date(
          today.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return {
          startDate: defaultThirtyDaysAgo,
          endDate: todayEnd,
        };
      }
    }
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
            // Kiểm tra xem service có cho phép nhập số lượng hay không
            let finalQuantity = serviceDto.quantity;
            if (!service.allow_quantity) {
              // Nếu service không cho phép quantity, force về 1 và validate
              if (serviceDto.quantity > 1) {
                throw new BadRequestException(
                  `Dịch vụ "${service.name}" không cho phép chọn số lượng. Chỉ có thể chọn 1 lần.`,
                );
              }
              finalQuantity = 1;
            }

            const serviceTotal = service.default_price * finalQuantity;
            servicesTotalAmount += serviceTotal;
            selectedServices.push({
              service_id: new Types.ObjectId(serviceDto.serviceId),
              service_name: service.name,
              service_price: service.default_price,
              quantity: finalQuantity,
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

      // Xử lý payment_method và deposit_paid_amount
      const paymentMethod = createBookingDto.payment_method || 'cash';
      let depositPaidAmount = createBookingDto.deposit_paid_amount || 0;
      let paymentStatus =
        createBookingDto.payment_status || PaymentStatus.UNPAID;

      // Tự động set deposit_paid_amount dựa trên payment_status từ frontend
      if (createBookingDto.payment_status === 'paid') {
        depositPaidAmount = finalAmount;
        paymentStatus = PaymentStatus.PAID;
      } else if (createBookingDto.payment_status === 'partially_paid') {
        // Sử dụng deposit_paid_amount từ frontend hoặc tính 50% mặc định
        depositPaidAmount =
          createBookingDto.deposit_paid_amount || Math.round(finalAmount * 0.5);
        paymentStatus = PaymentStatus.PARTIALLY_PAID;
      } else {
        // unpaid hoặc các trạng thái khác
        depositPaidAmount = createBookingDto.deposit_paid_amount || 0;
        paymentStatus = createBookingDto.payment_status || PaymentStatus.UNPAID;
      }

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
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        deposit_paid_amount: depositPaidAmount,
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
      await this.bookingNotificationService.createStaffNewBookingNotification(
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

        // Create summary notification for ONE representative admin only
        if (adminUsers.length > 0) {
          const representativeAdmin = adminUsers[0]; // Use first admin as representative
          await this.notificationsService.create({
            user_id: representativeAdmin._id.toString(),
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
              allAdminEmails: adminUsers.map((admin) => admin.email).join(', '), // Store all admin emails for reference
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

    // Normalize viewType (support aliases)
    const vt = queryDto.viewType || CalendarViewType.MONTHLY;
    const viewType =
      vt === CalendarViewType.DAY
        ? CalendarViewType.DAILY
        : vt === CalendarViewType.WEEK
          ? CalendarViewType.WEEKLY
          : vt === CalendarViewType.MONTH
            ? CalendarViewType.MONTHLY
            : vt;

    if (viewType === CalendarViewType.MONTHLY) {
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
    } else if (viewType === CalendarViewType.WEEKLY) {
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
    } else if (viewType === CalendarViewType.DAILY) {
      if (!queryDto.startDate) {
        startDate.setHours(0, 0, 0, 0);
      }
      if (!queryDto.endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (viewType === CalendarViewType.TODAY) {
      // TODAY view
      const today = new Date();
      startDate.setUTCFullYear(today.getUTCFullYear());
      startDate.setUTCMonth(today.getUTCMonth());
      startDate.setUTCDate(today.getUTCDate());
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCFullYear(today.getUTCFullYear());
      endDate.setUTCMonth(today.getUTCMonth());
      endDate.setUTCDate(today.getUTCDate());
      endDate.setUTCHours(23, 59, 59, 999);
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
        { path: 'guestId', select: 'name email' },
      ],
    });

    // Áp dụng tìm kiếm theo tên nếu có
    const searchedBookings = (() => {
      const { keyword, guestName, listingTitle, propertyName } = queryDto as {
        keyword?: string;
        guestName?: string;
        listingTitle?: string;
        propertyName?: string;
      };
      const hasNameFilters = Boolean(
        keyword || guestName || listingTitle || propertyName,
      );
      if (!hasNameFilters) return bookings;

      const toRegex = (v: string) => new RegExp(String(v), 'i');
      const kw = keyword ? toRegex(keyword) : null;
      const gRe = guestName ? toRegex(guestName) : null;
      const lRe = listingTitle ? toRegex(listingTitle) : null;
      const pRe = propertyName ? toRegex(propertyName) : null;

      return bookings.filter((b) => {
        const booking = b as any;
        const bGuestName = booking.guestId?.name || booking.guest_name || '';
        const bListingTitle = booking.listingId?.title || '';
        const bPropertyName = booking.propertyId?.name || '';

        const matchKw = kw
          ? kw.test(bGuestName) ||
            kw.test(bListingTitle) ||
            kw.test(bPropertyName)
          : true;
        const matchG = gRe ? gRe.test(bGuestName) : true;
        const matchL = lRe ? lRe.test(bListingTitle) : true;
        const matchP = pRe ? pRe.test(bPropertyName) : true;

        return matchKw && matchG && matchL && matchP;
      });
    })();

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
      const dayBookings: CalendarBookingDto[] = searchedBookings
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
          propertyId:
            (booking.propertyId as any)?._id?.toString() ||
            (booking.propertyId as any)?.toString(),
          property_name: (booking.propertyId as any)?.name || 'N/A',
          listingId:
            (booking.listingId as any)?._id?.toString() ||
            (booking.listingId as any)?.toString(),
          listing_title: (booking.listingId as any)?.title || 'N/A',
          checkInDate: booking.checkInDate,
          checkOutDate: booking.check_out_date,
          guests: booking.guests,
          status: booking.status,
          payment_status: booking.payment_status,
          final_amount: booking.final_amount,
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

    // Tính toán tổng quan (căn chỉnh với statistics/overview)
    const totalBookings = searchedBookings.length;

    // Chỉ tính doanh thu từ booking đã xác nhận/hoàn thành
    const revenueBookings = searchedBookings.filter((b: any) =>
      ['confirmed', 'completed'].includes(b.status),
    );
    const totalRevenue = revenueBookings.reduce(
      (sum: number, b: any) => sum + (b.final_amount || 0),
      0,
    );

    // Tính tỉ lệ lấp đầy = (tổng số đêm đã đặt trong kỳ) / (số ngày trong kỳ x số listing ACTIVE trong phạm vi) x 100
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(0, 0, 0, 0);
    const periodEndExclusive = new Date(
      endOfDay.getTime() + 24 * 60 * 60 * 1000,
    );
    const daysInPeriod = Math.floor(
      (periodEndExclusive.getTime() - startOfDay.getTime()) /
        (24 * 60 * 60 * 1000),
    );

    // Đếm số listing ACTIVE trong phạm vi
    let activeListingsCount = 0;
    if (queryDto.listingId) {
      activeListingsCount = await this.listingModel.countDocuments({
        _id: new Types.ObjectId(queryDto.listingId),
        status: ListingStatus.ACTIVE,
      });
    } else if (queryDto.propertyId) {
      activeListingsCount = await this.listingModel.countDocuments({
        propertyId: new Types.ObjectId(queryDto.propertyId),
        status: ListingStatus.ACTIVE,
      });
    } else if (user?.role === 'staff' && request?.staffPropertyIds?.length) {
      activeListingsCount = await this.listingModel.countDocuments({
        propertyId: {
          $in: request.staffPropertyIds.map(
            (id: string) => new Types.ObjectId(id),
          ),
        },
        status: ListingStatus.ACTIVE,
      });
    } else {
      activeListingsCount = await this.listingModel.countDocuments({
        status: ListingStatus.ACTIVE,
      });
    }

    const totalPossibleNights = daysInPeriod * activeListingsCount;

    // Tổng số room-night duy nhất (dedup overbooking) trong khoảng ngày hiển thị, checkOut exclusive
    const dayMs = 24 * 60 * 60 * 1000;
    const uniqueRoomNights = new Set<string>();
    for (const b of revenueBookings as any[]) {
      const bStart = new Date(b.checkInDate);
      const bEndExclusive = new Date(new Date(b.check_out_date).getTime());
      const overlapStart = new Date(
        Math.max(bStart.getTime(), startOfDay.getTime()),
      );
      const overlapEndExclusive = new Date(
        Math.min(bEndExclusive.getTime(), periodEndExclusive.getTime()),
      );
      // Build listing id string
      const listingKey =
        b?.listingId && typeof b.listingId === 'object' && b.listingId._id
          ? String(b.listingId._id)
          : String(b.listingId || '');
      for (
        let d = new Date(overlapStart);
        d < overlapEndExclusive;
        d = new Date(d.getTime() + dayMs)
      ) {
        const dateStr = d.toISOString().split('T')[0];
        uniqueRoomNights.add(`${listingKey}::${dateStr}`);
      }
    }

    const totalRoomNightsBooked = uniqueRoomNights.size;
    const averageOccupancy =
      totalPossibleNights > 0
        ? Math.min(
            100,
            Math.round(
              (totalRoomNightsBooked / totalPossibleNights) * 100 * 100,
            ) / 100,
          )
        : 0;

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      viewType,
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
      propertyId:
        (booking.propertyId as any)?._id?.toString() ||
        (booking.propertyId as any)?.toString(),
      property_name: (booking.propertyId as any)?.name,
      listingId:
        (booking.listingId as any)?._id?.toString() ||
        (booking.listingId as any)?.toString(),
      listing_title: (booking.listingId as any)?.title,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.check_out_date,
      guests: booking.guests,
      status: booking.status,
      payment_status: booking.payment_status,
      final_amount: booking.final_amount,
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
