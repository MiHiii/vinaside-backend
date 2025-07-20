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
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  })
  propertyId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Listing',
    required: true,
    index: true,
  })
  listingId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  guestId: Types.ObjectId;

  @Prop({ required: true })
  checkInDate: Date;

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

  // VNPay specific fields
  @Prop()
  vnpay_transaction_no?: string;

  @Prop()
  vnpay_bank_tran_no?: string;

  @Prop()
  vnpay_card_type?: string;

  @Prop()
  vnpay_order_id?: string;

  @Prop()
  vnpay_pay_date?: Date;

  @Prop()
  vnpay_response_code?: string;

  // MoMo specific fields
  @Prop()
  momo_trans_id?: string;

  @Prop()
  momo_request_id?: string;

  @Prop()
  momo_order_id?: string;

  @Prop()
  momo_pay_type?: string;

  @Prop()
  momo_response_time?: Date;

  @Prop()
  momo_result_code?: number;

  @Prop()
  momo_extra_data?: string;

  // Generic payment gateway fields
  @Prop({ type: MongooseSchema.Types.Mixed })
  gateway_raw_response?: Record<string, any>;

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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Voucher',
    required: false,
    index: true,
  })
  voucher_id?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
  })
  voucher_code?: string;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  voucher_discount_amount?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  voucher_discount_percent?: number;

  @Prop({
    type: [
      {
        service_id: { type: MongooseSchema.Types.ObjectId, ref: 'Service' },
        service_name: String,
        service_price: Number,
        quantity: Number,
        total_price: Number,
      },
    ],
    required: false,
    default: [],
  })
  selected_services?: Array<{
    service_id: Types.ObjectId;
    service_name: string;
    service_price: number;
    quantity: number;
    total_price: number;
  }>;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  services_total_amount?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  subtotal_amount?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  discount_amount?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
    min: 0,
  })
  amount_after_discount?: number;

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
BookingSchema.index({ listingId: 1 });
BookingSchema.index({ guestId: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ payment_status: 1 });
BookingSchema.index({ check_out_date: 1 });
BookingSchema.index({ isDeleted: 1 });
BookingSchema.index({ created_at: -1 });
