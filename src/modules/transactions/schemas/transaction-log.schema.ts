import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransactionStatus } from './transaction.schema';

export type TransactionLogDocument = TransactionLog & Document;

export enum ChangedBy {
  GUEST = 'guest',
  STAFF = 'staff',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class TransactionLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true,
  })
  transaction_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: TransactionStatus,
  })
  from_status?: TransactionStatus;

  @Prop({
    type: String,
    enum: TransactionStatus,
    required: true,
  })
  to_status: TransactionStatus;

  @Prop({
    type: String,
    enum: ChangedBy,
    required: true,
    index: true,
  })
  changed_by: ChangedBy;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  changed_by_user?: Types.ObjectId;

  @Prop({
    type: String,
    trim: true,
  })
  note?: string;

  @Prop({
    type: Date,
    default: Date.now,
    index: true,
  })
  timestamp: Date;

  @Prop({
    type: Object,
  })
  metadata?: Record<string, any>;

  @Prop({
    default: false,
  })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export const TransactionLogSchema =
  SchemaFactory.createForClass(TransactionLog);

// Indexes for better query performance
TransactionLogSchema.index({ transaction_id: 1, timestamp: -1 });
TransactionLogSchema.index({ changed_by: 1 });
TransactionLogSchema.index({ to_status: 1 });
TransactionLogSchema.index({ createdAt: -1 });
TransactionLogSchema.index({ isDeleted: 1 });

// Transform JSON output
TransactionLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

// Transform toObject output
TransactionLogSchema.set('toObject', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
