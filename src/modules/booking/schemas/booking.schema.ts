import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum PayoutStatus {
  HOLD = 'hold',
  PROCESSING = 'processing',
  PAID = 'paid',
  REJECTED = 'rejected',
  MANUAL_REQUESTED = 'manual_requested',
}

export enum RefundStatus {
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  REFUNDED = 'refunded',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Booking extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  guestId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  hostId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Room',
    required: true,
  })
  listingId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  checkIn: Date;

  @Prop({ required: true })
  checkOut: Date;

  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @Prop({ required: true, default: 0.1 })
  commissionRate: number;

  @Prop({ required: true, min: 0 })
  finalPayoutAmount: number;

  @Prop()
  guestNote: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Transaction',
  })
  paymentId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Transaction',
  })
  payoutId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    enum: PayoutStatus,
    default: PayoutStatus.HOLD,
  })
  payoutStatus: PayoutStatus;

  @Prop()
  payoutNote: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Transaction',
  })
  refundId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    enum: RefundStatus,
    default: null,
  })
  refundStatus: RefundStatus;

  @Prop({
    type: String,
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Thêm index để tăng tốc độ truy vấn
BookingSchema.index({ guestId: 1 });
BookingSchema.index({ hostId: 1 });
BookingSchema.index({ listingId: 1 });
BookingSchema.index({ checkIn: 1, checkOut: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ payoutStatus: 1 });
BookingSchema.index({ isDeleted: 1 });
BookingSchema.index({ createdAt: 1 });
