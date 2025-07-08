/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-call */
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
        label: labelFn(label),
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

    statusStats.forEach((stat: any) => {
      statusBreakdown[stat._id] = stat.count;
    });

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

    return {
      totalRevenue: financial.totalRevenue,
      totalServiceFees: financial.totalServiceFees,
      totalTaxAmount: financial.totalTaxAmount,
      totalRefunds: financial.totalRefunds,
      netRevenue: financial.totalRevenue - financial.totalRefunds,
      averageBookingValue: Math.round(financial.averageBookingValue as number),
      revenueByMonth: revenueByMonth.map((item: any) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        revenue: item.revenue,
        bookings: item.bookings,
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
}
