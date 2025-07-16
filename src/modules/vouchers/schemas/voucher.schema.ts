import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export interface AppliesTo {
  property_id?: Types.ObjectId;
  room_ids?: Types.ObjectId[];
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Voucher extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  code: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 50,
  })
  discount_percent: number;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  max_uses: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  uses_count: number;

  @Prop({
    type: Number,
    required: false,
    default: 3,
    min: 1,
    max: 10,
  })
  max_uses_per_user?: number;

  @Prop({
    type: Date,
    required: true,
  })
  expiration_date: Date;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  is_active: boolean;

  @Prop({
    type: String,
    required: false,
  })
  description?: string;

  @Prop({
    type: Number,
    required: false,
    min: 0,
    default: 0,
  })
  min_order_value?: number;

  @Prop({
    type: {
      property_id: { type: MongooseSchema.Types.ObjectId, ref: 'Property' },
      room_ids: [{ type: MongooseSchema.Types.ObjectId, ref: 'Listing' }],
    },
    required: false,
  })
  applies_to?: AppliesTo;

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

export const VoucherSchema = SchemaFactory.createForClass(Voucher);

// Indexes
VoucherSchema.index({ code: 1 });
VoucherSchema.index({ is_active: 1 });
VoucherSchema.index({ expiration_date: 1 });
VoucherSchema.index({ isDeleted: 1 });
VoucherSchema.index({ created_at: -1 });
VoucherSchema.index({ 'applies_to.property_id': 1 });
VoucherSchema.index({ 'applies_to.room_ids': 1 });
VoucherSchema.index({ min_order_value: 1 });
