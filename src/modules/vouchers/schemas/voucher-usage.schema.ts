import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class VoucherUsage extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Voucher',
    required: true,
    index: true,
  })
  voucher_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  })
  booking_id: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  discount_amount: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  order_amount: number;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
  })
  used_at: Date;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  updatedBy?: Types.ObjectId;
}

export const VoucherUsageSchema = SchemaFactory.createForClass(VoucherUsage);

// Compound indexes for efficient queries
VoucherUsageSchema.index({ voucher_id: 1, user_id: 1 });
VoucherUsageSchema.index({ user_id: 1, created_at: -1 });
VoucherUsageSchema.index({ voucher_id: 1, used_at: -1 });
VoucherUsageSchema.index({ booking_id: 1 });

// Unique index to prevent duplicate usage for same booking
VoucherUsageSchema.index({ voucher_id: 1, booking_id: 1 }, { unique: true });
