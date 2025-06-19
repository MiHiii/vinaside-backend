import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  PopulateOptions,
  SortOrder,
  Types,
} from 'mongoose';
import { Booking, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

interface UpdateFields {
  updatedBy?: Types.ObjectId;
  [key: string]: any;
}

interface DeleteFields {
  isDeleted: boolean;
  deletedAt: Date | undefined;
  deletedBy: Types.ObjectId | undefined;
}

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
export class BookingRepo {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
  ) {}

  /**
   * Tạo booking mới
   */
  async create(
    createBookingDto: CreateBookingDto,
    guestId: string,
  ): Promise<Booking> {
    const createdBy = new Types.ObjectId(guestId);

    const data = {
      ...createBookingDto,
      guest_id: createdBy,
      createdBy,
    };

    const booking = new this.bookingModel(data);
    return await booking.save();
  }

  /**
   * Tìm booking theo ID
   */
  async findById(
    id: string,
    populate?: PopulateOptions | Array<PopulateOptions>,
  ): Promise<Booking | null> {
    const query = this.bookingModel.findById(id);

    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
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
      populate?: PopulateOptions | Array<PopulateOptions>;
    } = {},
  ): Promise<{ data: Booking[]; total: number }> {
    const { sort, limit, skip, populate } = options;

    const query = this.bookingModel.find(filter);

    if (sort) {
      query.sort(sort);
    }

    if (skip !== undefined) {
      query.skip(skip);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    if (populate) {
      if (Array.isArray(populate)) {
        for (const p of populate) {
          query.populate(p);
        }
      } else {
        query.populate(populate);
      }
    }

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
    userId?: string,
  ): Promise<Booking | null> {
    const dataToUpdate: UpdateFields = { ...updateData };
    if (userId) {
      dataToUpdate.updatedBy = new Types.ObjectId(userId);
    }

    return await this.bookingModel
      .findByIdAndUpdate(id, dataToUpdate, { new: true })
      .populate([
        { path: 'guest_id', select: 'name avatar email phone' },
        { path: 'host_id', select: 'name avatar email phone' },
        { path: 'listing_id', select: 'title address images price_per_night' },
      ])
      .exec();
  }

  /**
   * Xóa mềm booking
   */
  async softDelete(id: string, userId?: string): Promise<Booking | null> {
    const updateData: DeleteFields = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    return await this.bookingModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Khôi phục booking đã xóa mềm
   */
  async restore(id: string): Promise<Booking | null> {
    const updateData: DeleteFields = {
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
    };

    return await this.bookingModel
      .findByIdAndUpdate(id, updateData, { new: true })
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
      listing_id: listingId,
      status: { $nin: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
      isDeleted: false,
      $or: [
        {
          check_in_date: { $lt: checkOut },
          check_out_date: { $gt: checkIn },
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
    const fullFilter = { ...filter, guest_id: guestId };
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
    const fullFilter = { ...filter, host_id: hostId };
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
    const fullFilter = { ...filter, listing_id: listingId };
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
      .populate('guest_id', 'name email')
      .populate('host_id', 'name email')
      .populate('listing_id', 'name price')
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
    includeDeleted: boolean,
  ): FilterQuery<Booking> {
    const query: FilterQuery<Booking> = {};

    if (filters.guest_id) {
      query.guest_id = new Types.ObjectId(filters.guest_id);
    }

    if (filters.host_id) {
      query.host_id = new Types.ObjectId(filters.host_id);
    }

    if (filters.listing_id) {
      query.listing_id = new Types.ObjectId(filters.listing_id);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.payment_status) {
      query.payment_status = filters.payment_status;
    }

    // Date range filters
    if (filters.check_in_from || filters.check_in_to) {
      const checkInQuery: { $gte?: Date; $lte?: Date } = {};
      if (filters.check_in_from) {
        checkInQuery.$gte = new Date(filters.check_in_from);
      }
      if (filters.check_in_to) {
        checkInQuery.$lte = new Date(filters.check_in_to);
      }
      query.check_in_date = checkInQuery;
    }

    if (filters.check_out_from || filters.check_out_to) {
      const checkOutQuery: { $gte?: Date; $lte?: Date } = {};
      if (filters.check_out_from) {
        checkOutQuery.$gte = new Date(filters.check_out_from);
      }
      if (filters.check_out_to) {
        checkOutQuery.$lte = new Date(filters.check_out_to);
      }
      query.check_out_date = checkOutQuery;
    }

    // Amount range filters
    if (filters.amount_from !== undefined || filters.amount_to !== undefined) {
      const amountQuery: { $gte?: number; $lte?: number } = {};
      if (filters.amount_from !== undefined) {
        amountQuery.$gte = filters.amount_from;
      }
      if (filters.amount_to !== undefined) {
        amountQuery.$lte = filters.amount_to;
      }
      query.final_amount = amountQuery;
    }

    // Text search filters
    if (filters.guest_name) {
      query.guest_name = { $regex: filters.guest_name, $options: 'i' };
    }

    if (filters.guest_email) {
      query.guest_email = { $regex: filters.guest_email, $options: 'i' };
    }

    if (filters.guest_phone) {
      query.guest_phone = { $regex: filters.guest_phone, $options: 'i' };
    }

    if (!includeDeleted) {
      query.isDeleted = false;
    }

    return query;
  }

  /**
   * Kiểm tra quyền truy cập vào booking
   */
  async checkPermission(
    bookingId: string,
    userId: string,
    role: string,
  ): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking với ID ${bookingId}`);
    }

    if (role === 'admin') {
      return booking;
    }

    if (role === 'host') {
      if (booking.host_id.toString() !== userId) {
        throw new BadRequestException(
          'Bạn không có quyền thao tác với booking này',
        );
      }
      return booking;
    }

    if (role === 'guest') {
      if (booking.guest_id.toString() !== userId) {
        throw new BadRequestException(
          'Bạn không có quyền thao tác với booking này',
        );
      }
      return booking;
    }

    throw new BadRequestException('Bạn không có quyền thực hiện thao tác này');
  }

  /**
   * Kiểm tra xung đột booking theo thời gian
   */
  async checkBookingConflict(
    listingId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<number> {
    const query: FilterQuery<Booking> = {
      listing_id: listingId,
      status: { $nin: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
      isDeleted: false,
      $or: [
        {
          check_in_date: { $lt: checkOut },
          check_out_date: { $gt: checkIn },
        },
      ],
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    return await this.bookingModel.countDocuments(query);
  }
}
