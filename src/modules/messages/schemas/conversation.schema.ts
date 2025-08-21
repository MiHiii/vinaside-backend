import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ enum: ['property'], required: true })
  type: 'property';

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  property_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  guest_id: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  staff_ids: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  last_active_staff_id?: Types.ObjectId;

  @Prop()
  last_active_staff_at?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  last_message_id?: Types.ObjectId;

  @Prop()
  last_message_at?: Date;

  @Prop({ type: Map, of: Date, default: {} })
  read_at: Map<string, Date>;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ property_id: 1, guest_id: 1 }, { unique: true });
ConversationSchema.index({ last_message_at: -1 });
ConversationSchema.index({ staff_ids: 1 });
