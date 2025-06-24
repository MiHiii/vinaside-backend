import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum CancelPolicy {
  FLEXIBLE = 'flexible',
  MODERATE = 'moderate',
  STRICT = 'strict',
}

export enum ListingStatus {
  ACTIVE = 'active', // Phòng đang hoạt động và hiển thị
  INACTIVE = 'inactive', // Tạm ngưng hiển thị
  DRAFT = 'draft', // Đang tạo nhưng chưa public
  PENDING_APPROVAL = 'pending_approval', // Chờ admin duyệt
  VERIFIED = 'verified', // Đã kiểm duyệt
  DELETED = 'deleted', // Đã xóa (soft delete)
}

export type Point = {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
};

@Schema({ timestamps: true })
export class Listing extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  })
  propertyId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ required: true })
  price_per_night: number;

  @Prop({ default: 2 })
  guests: number;

  @Prop({ required: true })
  max_guests: number;

  @Prop({ default: false })
  allow_infants: boolean;

  @Prop({ default: 0 })
  max_infants: number;

  @Prop({ required: true })
  beds: number;

  @Prop({ required: true })
  bathrooms: number;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Amenity' }] })
  amenities: Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'HouseRule' }] })
  house_rules_selected: Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'SafetyFeature' }],
  })
  safety_features: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  other_rules: string[];

  @Prop({
    type: String,
    enum: CancelPolicy,
    default: CancelPolicy.FLEXIBLE,
  })
  cancel_policy: CancelPolicy;

  @Prop({ default: false })
  allow_pets: boolean;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({
    type: String,
    enum: ListingStatus,
    default: ListingStatus.DRAFT,
  })
  status: ListingStatus;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: 0 })
  average_rating: number;

  @Prop({ default: 0 })
  reviews_count: number;

  // Timestamps and user tracking
  @Prop({ type: MongooseSchema.Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  updatedBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

// Indexes
ListingSchema.index({ propertyId: 1 });
ListingSchema.index({ status: 1 });
ListingSchema.index({ price_per_night: 1 });
ListingSchema.index({ isDeleted: 1 });
