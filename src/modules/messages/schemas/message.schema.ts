import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export enum ReactionType {
  LIKE = 'like',
  LOVE = 'love',
  LAUGH = 'laugh',
  WOW = 'wow',
  SAD = 'sad',
  ANGRY = 'angry',
}

@Schema()
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ type: String, enum: ReactionType, required: true })
  type: ReactionType;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;
}

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversation_id: Types.ObjectId;

  // Denormalize để tiện filter
  @Prop({ type: Types.ObjectId, ref: 'Property' })
  property_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  guest_id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  receiver_id?: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  sent_at: Date;

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  is_read: MessageStatus;

  @Prop({ type: [Reaction], default: [] })
  reactions: Reaction[];

  @Prop({ type: Boolean, default: false })
  is_recalled: boolean;

  @Prop({ type: Date })
  recalled_at?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
  reply_to_message_id?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversation_id: 1, sent_at: 1 });
MessageSchema.index({ sender_id: 1, sent_at: -1 });
MessageSchema.index({ property_id: 1, guest_id: 1, sent_at: -1 });
MessageSchema.index({ conversation_id: 1, sent_at: -1 });
MessageSchema.index({ property_id: 1, sent_at: -1 });
