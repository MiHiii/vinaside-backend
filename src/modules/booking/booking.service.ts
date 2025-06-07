import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SortOrder } from 'mongoose';
import { Booking } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { removeUndefinedObject, toSafeString } from '../../utils/common.util';
import { BookingRepo } from './booking.repo';

// Define types for filter parameters
interface BookingFilters extends Record<string, unknown> {
  guestId?: string;
  hostId?: string;
  listingId?: string;
  status?: string;
  paymentStatus?: string;
  payoutStatus?: string;
  refundStatus?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private readonly bookingRepo: BookingRepo) {}

  /**
   * Tạo đặt phòng mới
   */
  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    try {
      // Kiểm tra xem phòng có sẵn sàng trong khoảng thời gian yêu cầu không
      const isAvailable = await this.bookingRepo.checkRoomAvailability(
        createBookingDto.listingId,
        new Date(createBookingDto.checkIn),
        new Date(createBookingDto.checkOut),
      );

      if (!isAvailable) {
        throw new ConflictException(
          'Phòng không khả dụng trong khoảng thời gian này',
        );
      }

      // Kiểm tra ngày check-in < ngày check-out
      if (
        new Date(createBookingDto.checkIn) >=
        new Date(createBookingDto.checkOut)
      ) {
        throw new BadRequestException(
          'Ngày check-in phải trước ngày check-out',
        );
      }

      // Tính finalPayoutAmount nếu không được cung cấp
      if (!createBookingDto.finalPayoutAmount) {
        const commissionRate = createBookingDto.commissionRate || 0.1;
        createBookingDto.finalPayoutAmount =
          createBookingDto.totalPrice * (1 - commissionRate);
      }

      // Tạo đặt phòng mới
      return await this.bookingRepo.create(createBookingDto);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tạo đặt phòng: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi tạo đặt phòng: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Tìm tất cả đặt phòng theo điều kiện lọc
   */
  async findAll(queryDto: QueryBookingDto) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeDeleted = false,
        ...filtersRaw
      } = queryDto;

      // Tạo biến truy vấn với kiểu dữ liệu rõ ràng
      const query = this.bookingRepo.buildFilterQuery(
        filtersRaw as BookingFilters,
        includeDeleted,
      );

      // Tính toán skip cho phân trang
      const skip = (page - 1) * limit;

      // Xây dựng sort
      const sort: Record<string, SortOrder> = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1,
      };

      // Thực hiện query
      const result = await this.bookingRepo.findAll(query, {
        sort,
        skip,
        limit,
        populate: true,
      });

      // Trả về kết quả đã phân trang
      return {
        data: result.data,
        meta: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tìm kiếm đặt phòng: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi tìm kiếm đặt phòng: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Tìm đặt phòng theo ID
   */
  async findOne(id: string): Promise<Booking> {
    try {
      const booking = await this.bookingRepo.findById(id);

      if (!booking) {
        throw new NotFoundException(`Không tìm thấy đặt phòng với ID ${id}`);
      }

      return booking;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tìm đặt phòng theo ID: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi tìm đặt phòng theo ID: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Cập nhật đặt phòng
   */
  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
  ): Promise<Booking> {
    try {
      const booking = await this.bookingRepo.findById(id);

      if (!booking) {
        throw new NotFoundException(`Không tìm thấy đặt phòng với ID ${id}`);
      }

      // Kiểm tra xem ngày check-in hoặc check-out có thay đổi không
      if (
        ((updateBookingDto.checkIn || updateBookingDto.checkOut) &&
          updateBookingDto.checkIn !== booking.checkIn.toISOString()) ||
        updateBookingDto.checkOut !== booking.checkOut.toISOString()
      ) {
        // Nếu có thay đổi, kiểm tra lại tính khả dụng của phòng
        // Chuyển đổi listingId thành string an toàn
        const listingIdStr = toSafeString(booking.listingId);

        const isAvailable = await this.bookingRepo.checkRoomAvailability(
          listingIdStr,
          updateBookingDto.checkIn
            ? new Date(updateBookingDto.checkIn)
            : booking.checkIn,
          updateBookingDto.checkOut
            ? new Date(updateBookingDto.checkOut)
            : booking.checkOut,
          id, // Loại trừ đặt phòng hiện tại khi kiểm tra
        );

        if (!isAvailable) {
          throw new ConflictException(
            'Phòng không khả dụng trong khoảng thời gian này',
          );
        }

        // Kiểm tra ngày check-in < ngày check-out
        const checkIn = updateBookingDto.checkIn
          ? new Date(updateBookingDto.checkIn)
          : booking.checkIn;
        const checkOut = updateBookingDto.checkOut
          ? new Date(updateBookingDto.checkOut)
          : booking.checkOut;

        if (checkIn >= checkOut) {
          throw new BadRequestException(
            'Ngày check-in phải trước ngày check-out',
          );
        }
      }

      // Tính finalPayoutAmount nếu totalPrice hoặc commissionRate thay đổi
      if (
        (updateBookingDto.totalPrice || updateBookingDto.commissionRate) &&
        !updateBookingDto.finalPayoutAmount
      ) {
        const totalPrice = updateBookingDto.totalPrice || booking.totalPrice;
        const commissionRate =
          updateBookingDto.commissionRate !== undefined
            ? updateBookingDto.commissionRate
            : booking.commissionRate;

        updateBookingDto.finalPayoutAmount = totalPrice * (1 - commissionRate);
      }

      // Loại bỏ các trường undefined trước khi cập nhật
      const cleanUpdateData = removeUndefinedObject({ ...updateBookingDto });

      // Cập nhật thông tin đặt phòng
      const updatedBooking = await this.bookingRepo.updateById(
        id,
        cleanUpdateData,
      );

      if (!updatedBooking) {
        throw new NotFoundException(`Không tìm thấy đặt phòng với ID ${id}`);
      }

      return updatedBooking;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi cập nhật đặt phòng: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi cập nhật đặt phòng: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Xóa đặt phòng (soft delete)
   */
  async remove(id: string): Promise<Booking> {
    try {
      const booking = await this.bookingRepo.findById(id);

      if (!booking) {
        throw new NotFoundException(`Không tìm thấy đặt phòng với ID ${id}`);
      }

      // Soft delete
      const deletedBooking = await this.bookingRepo.softDelete(id);

      if (!deletedBooking) {
        throw new NotFoundException(`Không thể xóa đặt phòng với ID ${id}`);
      }

      return deletedBooking;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi xóa đặt phòng: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi xóa đặt phòng: ${String(error)}`);
      }
      throw error;
    }
  }

  /**
   * Khôi phục đặt phòng đã xóa (soft delete)
   */
  async restore(id: string): Promise<Booking> {
    try {
      const booking = await this.bookingRepo.findById(id);

      if (!booking) {
        throw new NotFoundException(`Không tìm thấy đặt phòng với ID ${id}`);
      }

      // Khôi phục
      const restoredBooking = await this.bookingRepo.restore(id);

      if (!restoredBooking) {
        throw new NotFoundException(
          `Không thể khôi phục đặt phòng với ID ${id}`,
        );
      }

      return restoredBooking;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi khôi phục đặt phòng: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Lỗi khi khôi phục đặt phòng: ${String(error)}`);
      }
      throw error;
    }
  }
}
