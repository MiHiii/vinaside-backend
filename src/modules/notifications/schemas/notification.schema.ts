import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum NotificationType {
  BOOKING = 'booking',
  PAYMENT = 'payment',
  VERIFICATION = 'verification',
  REFUND = 'refund',
  MESSAGE = 'message',
  SYSTEM = 'system',
  REMINDER = 'reminder',
}

export enum RecipientType {
  GUEST = 'guest',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export enum SentMethod {
  EMAIL = 'email',
  IN_APP = 'in_app',
  SMS = 'sms',
  PUSH = 'push',
}

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ type: String, enum: RecipientType, required: true })
  recipient_type: RecipientType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ type: Types.ObjectId, ref: 'NotificationTemplate', required: false })
  notification_template_id?: Types.ObjectId;

  @Prop({ type: [String], enum: SentMethod, default: ['in_app'] })
  sent_method: SentMethod[];

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Prop({ type: Boolean, default: false })
  is_read: boolean;

  @Prop({ type: Date, default: null })
  sent_at: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index để tối ưu hóa query
NotificationSchema.index({ user_id: 1, isDeleted: 1 });
NotificationSchema.index({ user_id: 1, is_read: 1, isDeleted: 1 });
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ created_at: -1 });
