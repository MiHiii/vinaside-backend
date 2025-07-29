import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'wishlists',
})
export class Wishlist extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  property_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Listing', required: true })
  room_id: Types.ObjectId;

  @Prop({ default: false })
  isDelete: boolean;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);

// Indexes for better performance
WishlistSchema.index({ user_id: 1 });
WishlistSchema.index({ property_id: 1 });
WishlistSchema.index({ room_id: 1 });
WishlistSchema.index({ isDelete: 1 });
WishlistSchema.index({ user_id: 1, isDelete: 1 });
WishlistSchema.index({ property_id: 1, isDelete: 1 });
WishlistSchema.index({ room_id: 1, isDelete: 1 });
WishlistSchema.index({ user_id: 1, room_id: 1 }, { unique: true });
WishlistSchema.index({ user_id: 1, property_id: 1 });
WishlistSchema.index({ property_id: 1, room_id: 1 });
WishlistSchema.index({ created_at: 1 });
