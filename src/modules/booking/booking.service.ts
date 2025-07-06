import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types, SortOrder } from 'mongoose';
import { Booking, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { parseSortString } from '../../utils/common.util';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { BookingRepo } from './booking.repo';
import { ListingService } from '../listing/listing.service';
import { PropertyService } from '../properties/services/property.service';
import { MailService } from '../mail/mail.service';
import { EmailQueueService } from '../mail/mail.queue';
import { ReservationData } from '../mail/interfaces/reservation-data.interface';

export interface PaginatedBookings {
  data: Booking[];
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
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Tạo một booking mới và trả về dữ liệu định dạng
   */
  async create(
    createBookingDto: CreateBookingDto,
    user: JwtPayload,
  ): Promise<Booking> {
    const { listingId, checkInDate, checkOutDate, guests } = createBookingDto;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

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
    }
    const populatedListing = listing as unknown as PopulatedListingForBooking;
    const propertyId = populatedListing.propertyId._id;

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24),
    );

    const totalPrice = populatedListing.price_per_night * nights;
    const serviceFee = totalPrice * 0.1;
    const taxAmount = totalPrice * 0.08;
    const finalAmount = totalPrice + serviceFee + taxAmount;
    const commissionRate = 0.1;
    const finalPayoutAmount = totalPrice * (1 - commissionRate);

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

    return createdBooking;
  }

  /**
   * Tìm một booking theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(id, {
      populate: ['listingId', 'propertyId', 'guestId'],
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking với ID ${id}.`);
    }

    return booking;
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
    });

    return {
      data,
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
      bookings: result.data,
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
        bookings: result.data,
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
      bookings: result.data,
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
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
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
          { path: 'listingId', select: 'title address images price_per_night' },
          { path: 'guestId', select: 'name avatar email phone' },
          { path: 'propertyId', select: 'name address' },
        ],
      });

      return {
        bookings: result.data,
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
        bookings: result.data,
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit) || 1,
        },
      };
    });
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
            select: 'title address images price_per_night',
          },
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
            select: 'title address images price_per_night',
          },
          { path: 'guestId', select: 'name avatar email phone' },
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
        populate: [{ path: 'guestId', select: 'name avatar email phone' }],
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
}
