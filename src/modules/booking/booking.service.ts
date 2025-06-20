import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { Booking, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import {
  removeUndefinedObject,
  parseSortString,
} from '../../utils/common.util';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { BookingRepo } from './booking.repo';
import { ListingService } from '../listing/listing.service';

interface BookingFilters extends Record<string, unknown> {
  guest_id?: string;
  host_id?: string;
  listing_id?: string;
  status?: string;
  payment_status?: string;
  check_in_from?: string;
  check_in_to?: string;
  check_out_from?: string;
  check_out_to?: string;
  amount_from?: number;
  amount_to?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly bookingRepo: BookingRepo,
    private readonly listingService: ListingService,
  ) {}

  // =========================== PUBLIC API METHODS ===========================

  /**
   * Tạo một booking mới và trả về dữ liệu định dạng
   */
  async create(createBookingDto: CreateBookingDto, user: JwtPayload) {
    const booking = await this.createBooking(createBookingDto, user);
    return { booking };
  }

  /**
   * Tìm một booking theo ID và trả về dữ liệu định dạng
   */
  async findOne(id: string) {
    const booking = await this.findBookingById(id);
    return { booking };
  }

  /**
   * Cập nhật thông tin booking và trả về dữ liệu định dạng
   */
  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
    user: JwtPayload,
  ) {
    const booking = await this.updateBooking(id, updateBookingDto, user);
    return { booking };
  }

  /**
   * Xóa mềm booking (soft delete) và trả về dữ liệu định dạng
   */
  async remove(id: string, user: JwtPayload) {
    await this.softDeleteBooking(id, user);
    return { success: true };
  }

  /**
   * Khôi phục booking đã xóa và trả về dữ liệu định dạng
   */
  async restore(id: string, user: JwtPayload) {
    const booking = await this.restoreBooking(id, user);
    return { booking };
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
  async findAll(queryDto: QueryBookingDto) {
    const result = await this.findAllWithFilters(queryDto);
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
   * Tìm danh sách booking của một host
   */
  async findByHost(hostId: string, queryDto: QueryBookingDto) {
    const result = await this.findBookingsByHost(hostId, queryDto);
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
   * Tìm danh sách booking của một listing
   */
  async findByListing(
    listingId: string,
    queryDto: QueryBookingDto,
    user?: JwtPayload,
  ) {
    // Kiểm tra quyền - chỉ host của listing hoặc admin mới được xem
    if (user && user.role !== 'admin') {
      // Kiểm tra xem user có phải là host của listing này không
      const listingResponse = await this.listingService.findOne(listingId);
      if (!listingResponse || !listingResponse.listing) {
        throw new NotFoundException(
          `Không tìm thấy listing với ID ${listingId}`,
        );
      }

      const listing = listingResponse.listing;
      if (listing.host_id.toString() !== user._id) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem booking của listing của mình',
        );
      }
    }

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
  ) {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Ngày check-out phải sau ngày check-in');
    }

    const conflictCount = await this.bookingRepo.checkBookingConflict(
      listingId,
      checkIn,
      checkOut,
    );

    return {
      available: conflictCount === 0,
      conflictCount,
      message:
        conflictCount > 0
          ? 'Listing đã được đặt trong khoảng thời gian này'
          : 'Listing available cho thời gian này',
    };
  }

  /**
   * Lấy các ngày đã được đặt cho một listing (cho Front-end calendar)
   */
  async getBookedDates(listingId: string) {
    try {
      // Tìm tất cả bookings confirmed hoặc pending cho listing này
      const bookings = await this.bookingRepo.findAll(
        {
          listing_id: new Types.ObjectId(listingId),
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
          isDeleted: false,
        },
        {
          sort: { check_in_date: 1 },
        },
      );

      const bookedDates: string[] = [];

      bookings.data.forEach((booking) => {
        const checkIn = new Date(booking.check_in_date);
        const checkOut = new Date(booking.check_out_date);

        // Generate tất cả ngày từ check-in đến check-out (exclusive check-out)
        const current = new Date(checkIn);
        while (current < checkOut) {
          bookedDates.push(current.toISOString().split('T')[0]); // Format: YYYY-MM-DD
          current.setDate(current.getDate() + 1);
        }
      });

      return {
        bookedDates: Array.from(new Set(bookedDates)).sort(), // Remove duplicates and sort
        totalBookings: bookings.total,
      };
    } catch (error) {
      this.handleError(error, 'Lấy ngày đã đặt');
    }
  }

  /**
   * Lấy tất cả bookings của host hiện tại (tất cả listings của host)
   */
  async findMyBookingsAsHost(user: JwtPayload, queryDto: QueryBookingDto) {
    if (!user || !user._id) {
      throw new BadRequestException('Thông tin người dùng không hợp lệ');
    }

    // Host chỉ xem được bookings của listings mình sở hữu
    if (user.role !== 'admin' && user.role !== 'host') {
      throw new ForbiddenException('Chỉ host và admin mới có quyền này');
    }

    const result = await this.findBookingsByHost(user._id, queryDto);
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
   * Lấy tất cả bookings của guest hiện tại (lịch sử đặt phòng)
   */
  async findMyBookingsAsGuest(user: JwtPayload, queryDto: QueryBookingDto) {
    if (!user || !user._id) {
      throw new BadRequestException('Thông tin người dùng không hợp lệ');
    }

    // Guest chỉ xem được bookings mình đã đặt
    if (user.role !== 'admin' && user.role !== 'guest') {
      throw new ForbiddenException('Chỉ guest và admin mới có quyền này');
    }

    const result = await this.findBookingsByGuest(user._id, queryDto);
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

  // ====================== INTERNAL METHODS ======================

  /**
   * Tạo một booking mới
   */
  private async createBooking(
    createBookingDto: CreateBookingDto,
    user: JwtPayload,
  ): Promise<Booking> {
    try {
      // Validate user information
      if (!user || !user._id) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }

      // Tính toán ngày và số đêm
      const checkInDate = new Date(createBookingDto.check_in_date);
      const checkOutDate = new Date(createBookingDto.check_out_date);
      const nights = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24),
      );

      if (nights <= 0) {
        throw new BadRequestException('Ngày check-out phải sau ngày check-in');
      }

      // Kiểm tra xung đột booking
      const conflictCount = await this.bookingRepo.checkBookingConflict(
        createBookingDto.listing_id,
        checkInDate,
        checkOutDate,
      );

      if (conflictCount > 0) {
        throw new BadRequestException(
          'Listing đã được đặt trong khoảng thời gian này',
        );
      }

      // Get listing info to get host_id and price
      const listingResponse = await this.listingService.findOne(
        createBookingDto.listing_id,
      );

      if (!listingResponse || !listingResponse.listing) {
        throw new NotFoundException(
          `Không tìm thấy listing với ID ${createBookingDto.listing_id}`,
        );
      }

      const listing = listingResponse.listing;
      const pricePerNight = listing.price_per_night || 100; // Use real price
      const hostId = listing.host_id;

      if (!hostId) {
        throw new BadRequestException('Listing không có thông tin host hợp lệ');
      }

      const totalPrice = pricePerNight * nights;
      const serviceFee = totalPrice * 0.1; // 10% service fee
      const taxAmount = totalPrice * 0.08; // 8% tax
      const finalAmount = totalPrice + serviceFee + taxAmount;

      // Calculate commission and payout
      const commissionRate = 0.1; // 10% commission
      const finalPayoutAmount = totalPrice * (1 - commissionRate);

      const bookingData = {
        // From DTO - only allowed fields
        listing_id: createBookingDto.listing_id,
        check_in_date: createBookingDto.check_in_date,
        check_out_date: createBookingDto.check_out_date,
        guests: createBookingDto.guests,
        infants: createBookingDto.infants || 0,
        special_requests: createBookingDto.special_requests,
        payment_method: createBookingDto.payment_method,

        // Calculated fields
        guest_id: user._id, // Explicitly set guest_id
        nights,
        price_per_night: pricePerNight,
        total_price: totalPrice,
        service_fee: serviceFee,
        tax_amount: taxAmount,
        final_amount: finalAmount,
        finalPayoutAmount,
        commissionRate,
        host_id: hostId,

        // Get guest info from JWT user, with DTO override option
        guest_name: createBookingDto.guest_name || user.name || 'Unknown Guest',
        guest_email:
          createBookingDto.guest_email || user.email || 'noemail@guest.com',
        guest_phone: createBookingDto.guest_phone || '', // TODO: Get from user profile in database
      };

      // Final validation of required fields
      if (
        !bookingData.guest_id ||
        !bookingData.host_id ||
        !bookingData.listing_id
      ) {
        throw new BadRequestException(
          'Thiếu thông tin bắt buộc: guest_id, host_id hoặc listing_id',
        );
      }

      if (!bookingData.finalPayoutAmount) {
        throw new BadRequestException('Không thể tính toán finalPayoutAmount');
      }

      const booking = await this.bookingRepo.create(bookingData, user._id);

      // Modules should be independent - no more listing status injection
      // Listing availability will be checked via booking conflict validation

      return booking;
    } catch (error) {
      this.handleError(error, 'Tạo booking');
    }
  }

  /**
   * Tìm tất cả bookings theo điều kiện query
   */
  private async findAllWithFilters(queryDto: QueryBookingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query dựa trên các bộ lọc
      const query = this.bookingRepo.buildFilterQuery(
        filters as BookingFilters,
        includeDeleted,
      );

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thiết lập tùy chọn truy vấn
      const options = {
        sort,
        skip,
        limit,
        populate: [
          { path: 'guest_id', select: 'name avatar email phone' },
          { path: 'host_id', select: 'name avatar email phone' },
          {
            path: 'listing_id',
            select: 'title address images price_per_night',
          },
        ],
      };

      return await this.bookingRepo.findAll(query, options);
    } catch (error) {
      this.handleError(error, 'Tìm kiếm bookings');
    }
  }

  /**
   * Tìm một booking theo ID
   */
  private async findBookingById(id: string): Promise<Booking> {
    try {
      const booking = await this.bookingRepo.findById(id, [
        { path: 'guest_id', select: 'name avatar email phone' },
        { path: 'host_id', select: 'name avatar email phone' },
        { path: 'listing_id', select: 'title address images price_per_night' },
      ]);

      if (!booking) {
        throw new NotFoundException(`Không tìm thấy booking với ID ${id}`);
      }

      return booking;
    } catch (error) {
      this.handleError(error, 'Tìm booking');
    }
  }

  /**
   * Cập nhật thông tin booking
   */
  private async updateBooking(
    id: string,
    updateBookingDto: UpdateBookingDto,
    user: JwtPayload,
  ): Promise<Booking> {
    try {
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.bookingRepo.checkPermission(id, user._id, user.role);

      // Loại bỏ các trường undefined
      const cleanUpdateData = removeUndefinedObject(updateBookingDto);

      // Cập nhật booking
      const updatedBooking = await this.bookingRepo.updateById(
        id,
        cleanUpdateData,
        user._id,
      );

      if (!updatedBooking) {
        throw new NotFoundException(`Không tìm thấy booking với ID ${id}`);
      }

      return updatedBooking;
    } catch (error) {
      this.handleError(error, 'Cập nhật booking');
    }
  }

  /**
   * Xóa mềm booking (soft delete)
   */
  private async softDeleteBooking(id: string, user: JwtPayload): Promise<void> {
    try {
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.bookingRepo.checkPermission(id, user._id, user.role);

      // Soft delete
      const deletedBooking = await this.bookingRepo.softDelete(id, user._id);

      if (!deletedBooking) {
        throw new NotFoundException(`Không thể xóa booking với ID ${id}`);
      }

      // Modules are independent - no listing status update needed
    } catch (error) {
      this.handleError(error, 'Xóa booking');
    }
  }

  /**
   * Khôi phục booking đã xóa
   */
  private async restoreBooking(id: string, user: JwtPayload): Promise<Booking> {
    try {
      // Kiểm tra quyền
      if (!user._id || !user.role) {
        throw new BadRequestException('Thông tin người dùng không hợp lệ');
      }
      await this.bookingRepo.checkPermission(id, user._id, user.role);

      // Khôi phục
      const restoredBooking = await this.bookingRepo.restore(id);

      if (!restoredBooking) {
        throw new NotFoundException(`Không thể khôi phục booking với ID ${id}`);
      }

      // Modules are independent - no listing status update needed

      return restoredBooking;
    } catch (error) {
      this.handleError(error, 'Khôi phục booking');
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
      await this.bookingRepo.checkPermission(id, user._id, user.role);

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

      // Xây dựng query với guest_id
      const guestObjectId = new Types.ObjectId(guestId);
      const query: FilterQuery<Booking> = { guest_id: guestObjectId };

      // Thêm các bộ lọc khác
      const fullQuery = {
        ...this.bookingRepo.buildFilterQuery(
          filters as BookingFilters,
          includeDeleted,
        ),
        ...query,
      };

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(fullQuery, {
        sort,
        skip,
        limit,
        populate: [
          { path: 'host_id', select: 'name avatar email phone' },
          {
            path: 'listing_id',
            select: 'title address images price_per_night',
          },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo guest');
    }
  }

  /**
   * Tìm các booking của một host
   */
  private async findBookingsByHost(hostId: string, queryDto: QueryBookingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filters
      } = queryDto;

      // Xây dựng query với host_id
      const hostObjectId = new Types.ObjectId(hostId);
      const query: FilterQuery<Booking> = { host_id: hostObjectId };

      // Thêm các bộ lọc khác
      const fullQuery = {
        ...this.bookingRepo.buildFilterQuery(
          filters as BookingFilters,
          includeDeleted,
        ),
        ...query,
      };

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(fullQuery, {
        sort,
        skip,
        limit,
        populate: [
          { path: 'guest_id', select: 'name avatar email phone' },
          {
            path: 'listing_id',
            select: 'title address images price_per_night',
          },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo host');
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

      // Xây dựng query với listing_id
      const listingObjectId = new Types.ObjectId(listingId);
      const query: FilterQuery<Booking> = { listing_id: listingObjectId };

      // Thêm các bộ lọc khác
      const fullQuery = {
        ...this.bookingRepo.buildFilterQuery(
          filters as BookingFilters,
          includeDeleted,
        ),
        ...query,
      };

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort = parseSortString(`${sortBy}:${sortOrder}`);

      // Thực hiện query
      return await this.bookingRepo.findAll(fullQuery, {
        sort,
        skip,
        limit,
        populate: [
          { path: 'guest_id', select: 'name avatar email phone' },
          { path: 'host_id', select: 'name avatar email phone' },
        ],
      });
    } catch (error) {
      this.handleError(error, 'Tìm bookings theo listing');
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
