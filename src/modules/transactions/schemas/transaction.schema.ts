import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  PAYMENT = 'payment',
  PAYOUT = 'payout',
  REFUND = 'refund',
}

export enum TransactionDirection {
  IN = 'in',
  OUT = 'out',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PaymentMethod {
  MOMO = 'momo',
  VNPAY = 'vnpay',
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  CASH = 'cash',
}

export enum PaymentProvider {
  MOMO = 'momo',
  VNPAY = 'vnpay',
  PAYPAL = 'paypal',
  INTERNAL = 'internal',
}

export enum ReferenceType {
  BOOKING = 'booking',
  MANUAL = 'manual',
  REFUND_REQUEST = 'refund_request',
  PAYOUT_REQUEST = 'payout_request',
  COMMISSION = 'commission',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({
    type: String,
    enum: TransactionType,
    required: true,
    index: true,
  })
  type: TransactionType;

  @Prop({
    type: Types.ObjectId,
    ref: 'Property',
    required: false,
    index: true,
  })
  propertyId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  reference_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ReferenceType,
    required: true,
    index: true,
  })
  reference_type: ReferenceType;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: TransactionDirection,
    required: true,
    index: true,
  })
  direction: TransactionDirection;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  amount: number;

  @Prop({
    type: String,
    default: 'VND',
    uppercase: true,
  })
  currency: string;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
    index: true,
  })
  status: TransactionStatus;

  @Prop({
    type: String,
    enum: PaymentMethod,
    required: true,
  })
  method: PaymentMethod;

  @Prop({
    type: String,
    trim: true,
  })
  note?: string;

  @Prop({
    type: String,
    enum: PaymentProvider,
  })
  provider?: PaymentProvider;

  @Prop({
    type: String,
    trim: true,
  })
  provider_transaction_id?: string;

  @Prop({
    type: String,
    trim: true,
  })
  provider_order_id?: string;

  @Prop({
    type: Object,
  })
  raw_response?: Record<string, any>;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  created_by?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  updated_by?: Types.ObjectId;

  @Prop({
    default: false,
    index: true,
  })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  deletedBy?: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Compound indexes for better query performance
TransactionSchema.index({ reference_type: 1, reference_id: 1 });
TransactionSchema.index({ propertyId: 1, status: 1 });
TransactionSchema.index({ propertyId: 1, type: 1 });
TransactionSchema.index({ user_id: 1, status: 1 });
TransactionSchema.index({ user_id: 1, type: 1 });
TransactionSchema.index({ user_id: 1, direction: 1 });
TransactionSchema.index({ provider: 1, provider_transaction_id: 1 });
TransactionSchema.index({ provider_order_id: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ isDeleted: 1 });

// Transform JSON output
TransactionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

// Transform toObject output
TransactionSchema.set('toObject', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
