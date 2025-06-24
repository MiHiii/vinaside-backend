import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Booking } from './schemas/booking.schema';
import { BaseRepo } from '../../database/repo/base.repo';

@Injectable()
export class BookingRepo extends BaseRepo<Booking> {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<Booking>,
  ) {
    super(bookingModel);
  }

  async checkBookingConflict(
    listingId: string,
    checkInDate: Date,
    checkOutDate: Date,
  ): Promise<boolean> {
    const conflictQuery: FilterQuery<Booking> = {
      listingId: new Types.ObjectId(listingId),
      isDeleted: false,
      status: { $in: ['confirmed', 'pending'] },
      $or: [
        {
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate },
        },
      ],
    };
    const count = await this.bookingModel.countDocuments(conflictQuery);
    return count > 0;
  }
}
