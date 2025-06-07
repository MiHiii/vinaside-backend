import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { Booking, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

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

// Define type for MongoDB query operators
interface MongoDateRange {
  $gte?: Date;
  $lte?: Date;
  $lt?: Date;
  $gt?: Date;
}

@Injectable()
export class BookingRepo {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
  ) {}

  /**
   * Tạo booking mới
   */
  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const booking = new this.bookingModel(createBookingDto);
    return await booking.save();
  }

  /**
   * Tìm booking theo ID
   */
  async findById(
    id: string,
    populate: boolean = true,
  ): Promise<Booking | null> {
    let query = this.bookingModel.findById(id);

    if (populate) {
      query = query
        .populate('guestId', 'name email')
        .populate('hostId', 'name email')
        .populate('listingId', 'name price')
        .populate('paymentId')
        .populate('payoutId')
        .populate('refundId');
    }

    return await query.exec();
  }

  /**
   * Tìm tất cả bookings theo điều kiện
   */
  async findAll(
    filter: FilterQuery<Booking> = {},
    options: {
      sort?: Record<string, SortOrder>;
      limit?: number;
      skip?: number;
      populate?: boolean;
    } = {},
  ): Promise<{ data: Booking[]; total: number }> {
    const { sort, limit, skip, populate = true } = options;

    // Tạo query
    let query = this.bookingModel.find(filter);

    // Thêm sort nếu có
    if (sort) {
      query = query.sort(sort);
    }

    // Thêm phân trang nếu có
    if (skip !== undefined) {
      query = query.skip(skip);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    // Thêm populate nếu cần
    if (populate) {
      query = query
        .populate('guestId', 'name email')
        .populate('hostId', 'name email')
        .populate('listingId', 'name price')
        .populate('paymentId')
        .populate('payoutId')
        .populate('refundId');
    }

    // Thực hiện truy vấn
    const [data, total] = await Promise.all([
      query.exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Cập nhật booking
   */
  async updateById(
    id: string,
    updateData: Partial<UpdateBookingDto>,
  ): Promise<Booking | null> {
    return await this.bookingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('guestId', 'name email')
      .populate('hostId', 'name email')
      .populate('listingId', 'name price')
      .populate('paymentId')
      .populate('payoutId')
      .populate('refundId')
      .exec();
  }

  /**
   * Xóa mềm booking
   */
  async softDelete(id: string): Promise<Booking | null> {
    return await this.bookingModel
      .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
      .exec();
  }

  /**
   * Khôi phục booking đã xóa mềm
   */
  async restore(id: string): Promise<Booking | null> {
    return await this.bookingModel
      .findByIdAndUpdate(id, { isDeleted: false }, { new: true })
      .exec();
  }

  /**
   * Đếm số lượng booking trùng lặp thời gian cho một phòng
   */
  async countConflictingBookings(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<number> {
    const query: FilterQuery<Booking> = {
      listingId,
      status: { $nin: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
      isDeleted: false,
      $or: [
        {
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        },
      ],
    };

    // Loại trừ booking hiện tại nếu đang cập nhật
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    return await this.bookingModel.countDocuments(query);
  }

  /**
   * Kiểm tra tính khả dụng của phòng trong khoảng thời gian
   */
  async checkRoomAvailability(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const conflictingBookings = await this.countConflictingBookings(
      listingId,
      checkIn,
      checkOut,
      excludeBookingId,
    );

    // Nếu không có đặt phòng nào xung đột, phòng khả dụng
    return conflictingBookings === 0;
  }

  /**
   * Tìm tất cả bookings của một guest
   */
  async findByGuestId(
    guestId: string,
    filter: FilterQuery<Booking> = {},
    options = {},
  ): Promise<{ data: Booking[]; total: number }> {
    const fullFilter = { ...filter, guestId };
    return await this.findAll(fullFilter, options);
  }

  /**
   * Tìm tất cả bookings của một host
   */
  async findByHostId(
    hostId: string,
    filter: FilterQuery<Booking> = {},
    options = {},
  ): Promise<{ data: Booking[]; total: number }> {
    const fullFilter = { ...filter, hostId };
    return await this.findAll(fullFilter, options);
  }

  /**
   * Tìm tất cả bookings của một listing
   */
  async findByListingId(
    listingId: string,
    filter: FilterQuery<Booking> = {},
    options = {},
  ): Promise<{ data: Booking[]; total: number }> {
    const fullFilter = { ...filter, listingId };
    return await this.findAll(fullFilter, options);
  }

  /**
   * Cập nhật trạng thái booking
   */
  async updateStatus(
    id: string,
    status: BookingStatus,
  ): Promise<Booking | null> {
    return await this.bookingModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('guestId', 'name email')
      .populate('hostId', 'name email')
      .populate('listingId', 'name price')
      .populate('paymentId')
      .populate('payoutId')
      .populate('refundId')
      .exec();
  }

  /**
   * Xây dựng query filter cho booking
   */
  buildFilterQuery(
    filters: BookingFilters,
    includeDeleted = false,
  ): FilterQuery<Booking> {
    const query: FilterQuery<Booking> = {};

    // Lọc theo guestId nếu có
    if (filters.guestId) {
      query.guestId = filters.guestId;
    }

    // Lọc theo hostId nếu có
    if (filters.hostId) {
      query.hostId = filters.hostId;
    }

    // Lọc theo listingId nếu có
    if (filters.listingId) {
      query.listingId = filters.listingId;
    }

    // Lọc theo status nếu có
    if (filters.status) {
      query.status = filters.status;
    }

    // Lọc theo paymentStatus nếu có
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    // Lọc theo payoutStatus nếu có
    if (filters.payoutStatus) {
      query.payoutStatus = filters.payoutStatus;
    }

    // Lọc theo refundStatus nếu có
    if (filters.refundStatus) {
      query.refundStatus = filters.refundStatus;
    }

    // Lọc theo ngày check-in
    if (filters.checkInFrom || filters.checkInTo) {
      const checkInFilter: MongoDateRange = {};

      if (filters.checkInFrom) {
        checkInFilter.$gte = new Date(filters.checkInFrom);
      }
      if (filters.checkInTo) {
        checkInFilter.$lte = new Date(filters.checkInTo);
      }

      query.checkIn = checkInFilter;
    }

    // Lọc theo ngày check-out
    if (filters.checkOutFrom || filters.checkOutTo) {
      const checkOutFilter: MongoDateRange = {};

      if (filters.checkOutFrom) {
        checkOutFilter.$gte = new Date(filters.checkOutFrom);
      }
      if (filters.checkOutTo) {
        checkOutFilter.$lte = new Date(filters.checkOutTo);
      }

      query.checkOut = checkOutFilter;
    }

    // Không bao gồm bản ghi đã xóa trừ khi được yêu cầu
    if (!includeDeleted) {
      query.isDeleted = false;
    }

    return query;
  }
}
