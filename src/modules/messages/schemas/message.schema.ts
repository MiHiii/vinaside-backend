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
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiver_id: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  sent_at: Date;

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  is_read: MessageStatus;

  @Prop({ type: [Reaction], default: [] })
  reactions: Reaction[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
