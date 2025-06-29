import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Review extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  propertyId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Listing', required: true })
  room_id: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Thêm indexes để tối ưu truy vấn
ReviewSchema.index({ user_id: 1 });
ReviewSchema.index({ propertyId: 1 });
ReviewSchema.index({ room_id: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ created_at: -1 });

// Compound index cho truy vấn phổ biến
ReviewSchema.index({ propertyId: 1, created_at: -1 });
ReviewSchema.index({ room_id: 1, created_at: -1 });
ReviewSchema.index({ user_id: 1, created_at: -1 });
