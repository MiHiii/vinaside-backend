import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Booking extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  guest_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  host_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Listing', required: true })
  listing_id: Types.ObjectId;

  @Prop({ required: true })
  check_in_date: Date;

  @Prop({ required: true })
  check_out_date: Date;

  @Prop({ required: true, min: 1 })
  guests: number;

  @Prop({ default: 0, min: 0 })
  infants: number;

  @Prop({ required: true, min: 1 })
  nights: number;

  @Prop({ required: true, min: 0 })
  price_per_night: number;

  @Prop({ required: true, min: 0 })
  total_price: number;

  @Prop({ default: 0, min: 0 })
  service_fee: number;

  @Prop({ default: 0, min: 0 })
  tax_amount: number;

  @Prop({ required: true, min: 0 })
  final_amount: number;

  // Commission and payout fields
  @Prop({ required: true, default: 0.1 })
  commissionRate: number;

  @Prop({ required: true, min: 0 })
  finalPayoutAmount: number;

  @Prop({
    type: String,
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  payment_status: PaymentStatus;

  @Prop()
  payment_method?: string;

  @Prop()
  payment_id?: string;

  @Prop({ required: true })
  guest_name: string;

  @Prop({ required: true })
  guest_email: string;

  @Prop()
  guest_phone?: string;

  @Prop()
  special_requests?: string;

  @Prop()
  cancellation_reason?: string;

  @Prop()
  cancelled_at?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  cancelled_by?: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  updatedBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Thêm index cho các trường tìm kiếm phổ biến
BookingSchema.index({ guest_id: 1 });
BookingSchema.index({ host_id: 1 });
BookingSchema.index({ listing_id: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ payment_status: 1 });
BookingSchema.index({ check_in_date: 1, check_out_date: 1 });
BookingSchema.index({ isDeleted: 1 });
BookingSchema.index({ created_at: -1 });
