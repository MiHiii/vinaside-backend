import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class WishlistItem extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WishlistList',
    required: true,
  })
  wishlist_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Listing', required: true })
  room_id: Types.ObjectId;

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

export const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);

// Thêm index cho các trường tìm kiếm phổ biến
WishlistItemSchema.index({ wishlist_id: 1 });
WishlistItemSchema.index({ room_id: 1 });
WishlistItemSchema.index({ isDeleted: 1 });
WishlistItemSchema.index({ wishlist_id: 1, isDeleted: 1 });
WishlistItemSchema.index({ wishlist_id: 1, room_id: 1 }, { unique: true });
