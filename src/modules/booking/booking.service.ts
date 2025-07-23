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
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
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
      propertyId: booking.propertyId ? booking.propertyId.toString() : null,
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

    const listing = await this.listingService.findOne(listingId);
    if (!listing) {
      throw new NotFoundException(`Không tìm thấy listing với ID ${listingId}`);
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

    // Tính toán giá phòng cơ bản
    const totalPrice = populatedListing.price_per_night * nights; // Giá phòng cơ bản

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

        if (voucherValidation.valid && voucherValidation.voucher) {
          voucherId = voucherValidation.voucher._id as Types.ObjectId;
          voucherCodeValue = voucherValidation.voucher.code;
          voucherDiscountAmount = voucherValidation.discount_amount || 0;
          voucherDiscountPercent = voucherValidation.voucher.discount_percent;
          discountAmount = voucherDiscountAmount;
          amountAfterDiscount = subtotalAmount - discountAmount;
        } else {
          throw new BadRequestException(voucherValidation.message);
        }
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
        this.logger.log(
          `Voucher ${voucherCodeValue} used for booking ${(createdBooking._id as Types.ObjectId).toString()}`,
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
      await this.notificationsService.create({
        user_id: user._id,
        recipient_type: RecipientType.GUEST,
        title: 'Đặt phòng thành công',
        message: `Bạn đã đặt phòng thành công tại ${populatedListing.propertyId.name || populatedListing.title}. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')} VNĐ. Mã đặt phòng: ${(createdBooking._id as Types.ObjectId).toString().slice(-8)}`,
        type: NotificationType.BOOKING,
        status: NotificationStatus.SENT,
        sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
        avatar_url, // truyền avatar_url
      });
      this.logger.log(`Created booking notification for guest ${user._id}`);
    } catch (error) {
      this.logger.error(
        `Failed to create guest notification for booking ${(createdBooking._id as Types.ObjectId).toString()}:`,
        error,
      );
    }

    // Lấy staff emails từ property và gửi thông báo
    try {
      const staffEmails = await this.mailService.getStaffEmailsFromProperty(
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

        this.logger.log(
          `Sent staff notification emails to ${staffEmails.length} staff members for booking ${(createdBooking._id as Types.ObjectId).toString()}`,
        );

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

    return this.transformBookingToResponse(createdBooking);
  }

  /**
   * Tìm một booking theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findById(id, {
      populate: ['listingId', 'propertyId', 'guestId', 'voucher_id'],
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
    updateBookingDto: UpdateBookingDto,
    user: JwtPayload,
  ): Promise<Booking> {
    const updated = await this.bookingRepo.updateById(
      id,
      updateBookingDto,
      user._id,
    );
    if (!updated)
      throw new NotFoundException(
        'Không tìm thấy booking hoặc không thể cập nhật.',
      );
    return updated;
  }

  /**
   * Xóa mềm booking và trả về dữ liệu định dạng
   */
  async remove(id: string, user: JwtPayload): Promise<{ success: boolean }> {
    const deleted = await this.bookingRepo.softDelete(id, user._id);
    if (!deleted)
      throw new NotFoundException('Không tìm thấy booking hoặc không thể xóa.');
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

    // Tạo thông báo khi trạng thái booking thay đổi
    await this.createStatusChangeNotification(booking, status);

    return { booking };
  }

  /**
   * Tìm danh sách theo bộ lọc và trả về dữ liệu định dạng
   */
  async findAll(queryDto: QueryBookingDto): Promise<PaginatedBookings> {
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
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
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

    const sort: Record<string, SortOrder> = {
      [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1,
    };

    const { data, total } = await this.bookingRepo.findAll(query, {
      sort,
      skip,
      limit,
      populate: [
        { path: 'propertyId', select: 'name' },
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
   * Tìm danh sách booking của một properties
   */
  findByHost(propertyId: string, queryDto: QueryBookingDto) {
    return this.findBookingsByGuest(propertyId, queryDto).then((result) => {
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
      status: BookingStatus.CONFIRMED,
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
  async findMyBookingsAsHost(user: JwtPayload, queryDto: QueryBookingDto) {
    if (!user || !user._id) {
      throw new BadRequestException('Thông tin người dùng không hợp lệ');
    }

    if (user.role === 'admin') {
      // Admin xem tất cả bookings
      return this.findAll(queryDto);
    } else if (user.role === 'staff') {
      // Staff chỉ xem được bookings của properties mình được gán
      const staffProperties = await this.propertyService.findByStaff(
        user._id,
        {},
      );

      interface PropertyWithId {
        _id: Types.ObjectId;
      }

      const propertyIds = staffProperties.data.map((prop) =>
        (prop as unknown as PropertyWithId)._id.toString(),
      );

      if (propertyIds.length === 0) {
        return {
          bookings: [],
          meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
        };
      }

      // Filter bookings theo properties của staff bằng cách query multiple propertyId
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      const query: FilterQuery<Booking> = {
        propertyId: { $in: propertyIds.map((id) => new Types.ObjectId(id)) },
        isDeleted: includeDeleted,
      };

      // Thêm các bộ lọc khác
      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

      const skip = (page - 1) * limit;
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      const result = await this.bookingRepo.findAll(query, {
        sort,
        skip,
        limit,
        populate: [
          {
            path: 'listingId',
            select: 'title address images price_per_night cancel_policy',
          },
          { path: 'guestId', select: 'name avatar email phone' },
          { path: 'propertyId', select: 'name address' },
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
    } else {
      throw new ForbiddenException('Chỉ staff và admin mới có quyền này');
    }
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

  async cancelBookingPublic(id: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking');
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking đã bị hủy trước đó');
    }
    booking.status = BookingStatus.CANCELLED;
    booking.payment_status = PaymentStatus.REFUNDED;
    booking.cancelled_at = new Date();
    booking.cancellation_reason = 'Public user cancelled';
    await booking.save();
    return { success: true, message: 'Hủy booking thành công' };
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
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

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
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

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
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

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
   * Tạo thông báo cho staff khi có booking mới
   */
  private async createStaffNotifications(
    propertyId: string,
    booking: any,
    listing: any,
    finalAmount: number,
  ): Promise<void> {
    try {
      // Lấy danh sách staff của property
      const staffProperties = await this.propertyService.findByStaff(
        propertyId,
        {},
      );

      if (staffProperties.data.length === 0) {
        this.logger.warn(`No staff found for property ${propertyId}`);
        return;
      }

      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const propertyName =
        listing.propertyId.name || listing.title || 'Tài sản';

      // Tạo thông báo cho từng staff
      for (const staffProperty of staffProperties.data) {
        const staffId = (staffProperty as any).staff_id?.toString();
        if (!staffId) continue;

        try {
          await this.notificationsService.create({
            user_id: staffId,
            recipient_type: RecipientType.STAFF,
            title: 'Đặt phòng mới',
            message: `Có đặt phòng mới tại ${propertyName}. Mã đặt phòng: ${bookingCode}. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')} VNĐ. Khách: ${booking.guest_name}`,
            type: NotificationType.BOOKING,
            status: NotificationStatus.SENT,
            sent_method: [SentMethod.IN_APP],
          });
          this.logger.log(`Created staff notification for ${staffId}`);
        } catch (error) {
          this.logger.error(
            `Failed to create staff notification for ${staffId}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error creating staff notifications:', error);
    }
  }

  /**
   * Tạo thông báo khi trạng thái booking thay đổi
   */
  private async createStatusChangeNotification(
    booking: any,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const guestId = (booking.guestId as Types.ObjectId).toString();

      // Tạo thông báo cho khách hàng
      const statusMessages = {
        [BookingStatus.CONFIRMED]: 'Đặt phòng của bạn đã được xác nhận',
        [BookingStatus.CANCELLED]: 'Đặt phòng của bạn đã bị hủy',
        [BookingStatus.COMPLETED]: 'Đặt phòng của bạn đã hoàn thành',
        [BookingStatus.REJECTED]: 'Đặt phòng của bạn đã bị từ chối',
      };

      const message =
        statusMessages[newStatus] ||
        `Trạng thái đặt phòng đã thay đổi thành ${newStatus}`;

      await this.notificationsService.create({
        user_id: guestId,
        recipient_type: RecipientType.GUEST,
        title: `Cập nhật đặt phòng - ${newStatus}`,
        message: `${message}. Mã đặt phòng: ${bookingCode}`,
        type: NotificationType.BOOKING,
        status: NotificationStatus.SENT,
        sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
      });

      this.logger.log(
        `Created status change notification for booking ${bookingId}`,
      );

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
          revenue: { $sum: '$final_amount' },
          bookings: { $sum: 1 },
          nights: { $sum: '$nights' },
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

    // Thống kê tổng quan
    const overviewStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$final_amount' },
          totalNights: { $sum: '$nights' },
          totalGuests: { $sum: '$guests' },
          totalInfants: { $sum: '$infants' },
          averageBookingValue: { $avg: '$final_amount' },
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

    // Thống kê tài chính tổng quan
    const financialStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$final_amount' },
          totalServiceFees: { $sum: '$service_fee' },
          totalTaxAmount: { $sum: '$tax_amount' },
          totalRefunds: {
            $sum: {
              $cond: [
                { $eq: ['$payment_status', 'refunded'] },
                '$final_amount',
                0,
              ],
            },
          },
          averageBookingValue: { $avg: '$final_amount' },
        },
      },
    ]);

    // Thống kê doanh thu theo tháng
    const revenueByMonth = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          revenue: { $sum: '$final_amount' },
          bookings: { $sum: 1 },
          voucherDiscount: { $sum: '$voucher_discount_amount' },
          servicesRevenue: { $sum: '$services_total_amount' },
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

    // Calculate additional financial metrics
    const voucherServicesStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalVoucherDiscount: { $sum: '$voucher_discount_amount' },
          totalServicesRevenue: { $sum: '$services_total_amount' },
          totalRevenueBeforeVoucher: { $sum: '$subtotal_amount' },
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
    const filter = this.createStatisticsFilter(
      startDate,
      endDate,
      propertyId,
      listingId,
    );

    // Thống kê khách hàng
    const customerStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
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

    // Thống kê khách hàng mới vs quay lại
    const newCustomers = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
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
        customerId: customer._id.toString(),
        customerName: customer.guestName,
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

    // Voucher usage by customers
    const voucherUsageStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
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
      .sort((a: any, b: any) => b.totalVoucherDiscount - a.totalVoucherDiscount)
      .slice(0, 10)
      .map((user: any) => ({
        customerId: user._id.toString(),
        customerName: user.guestName,
        voucherUsageCount: user.voucherUsageCount,
        totalVoucherDiscount: user.totalVoucherDiscount,
      }));

    // Services usage by customers
    const servicesUsageStats = await this.bookingRepo.getModel().aggregate([
      { $match: filter },
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
        customerId: user._id.toString(),
        customerName: user.guestName,
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
}
