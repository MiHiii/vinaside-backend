import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum PropertyType {
  APARTMENT = 'apartment',
  MINI_APARTMENT = 'mini_apartment',
  HOMESTAY = 'homestay',
  VILLA = 'villa',
}

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

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Listing extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  host_id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  building_name?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], required: true })
  images: string[];

  @Prop({ required: true })
  address: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: Point;

  @Prop({ required: true })
  price_per_night: number;

  @Prop({
    type: String,
    enum: PropertyType,
    required: true,
  })
  property_type: PropertyType;

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

  @Prop({ required: true })
  check_in_time: string;

  @Prop({ required: true })
  check_out_time: string;

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
    default: ListingStatus.ACTIVE,
  })
  status: ListingStatus;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  average_rating?: number;

  @Prop({ default: 0 })
  reviews_count: number;

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

export const ListingSchema = SchemaFactory.createForClass(Listing);

// Thêm index cho location để hỗ trợ tìm kiếm theo vị trí địa lý
ListingSchema.index({ location: '2dsphere' });

// Thêm index cho các trường tìm kiếm phổ biến
ListingSchema.index({ host_id: 1 });
ListingSchema.index({ status: 1 });
ListingSchema.index({ property_type: 1 });
ListingSchema.index({ price_per_night: 1 });
ListingSchema.index({ isDeleted: 1 });
