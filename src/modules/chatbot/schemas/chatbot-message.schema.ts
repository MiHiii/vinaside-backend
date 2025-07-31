import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatbotMessage extends Document {
  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  user_id?: Types.ObjectId;

  @Prop({ required: false })
  reply?: string;
}

export const ChatbotMessageSchema =
  SchemaFactory.createForClass(ChatbotMessage);
