import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type PropertyDocument = Property & Document;

export enum PropertyType {
  APARTMENT = 'apartment',
  MINI_APARTMENT = 'mini_apartment',
  HOMESTAY = 'homestay',
  VILLA = 'villa',
}

@Schema({ timestamps: true })
export class Property {
  @Prop({ required: true })
  name: string; // Ví dụ: "Villa Gió Biển"

  @Prop({
    required: true,
    enum: PropertyType,
    default: PropertyType.HOMESTAY,
  })
  type: PropertyType;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  staffIds: Types.ObjectId[]; // Danh sách nhân viên được gán

  @Prop()
  description?: string;

  @Prop()
  thumbnail?: string; // Ảnh đại diện của property

  @Prop({ type: [String], default: [] })
  images: string[]; // Danh sách ảnh của property

  @Prop({
    type: {
      place_id: { type: String, index: true }, // Google Places ID for precise search
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
      city: String,
      district: String,
      ward: String,
      // GeoJSON Point for geospatial queries
      coordinates: {
        type: [Number], // [lng, lat] - GeoJSON format
        index: '2dsphere',
      },
    },
    required: true,
  })
  location: {
    place_id?: string; // Google Places ID
    lat: number;
    lng: number;
    address: string;
    city?: string;
    district?: string;
    ward?: string;
    coordinates?: [number, number]; // [lng, lat]
  };

  @Prop()
  checkInTime?: string; // Ví dụ: "14:00"

  @Prop()
  checkOutTime?: string; // Ví dụ: "12:00"

  @Prop()
  contactPhone?: string;

  @Prop()
  contactEmail?: string;

  @Prop({
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
  })
  status: string;

  @Prop({ default: false })
  isVerified: boolean; // Đã được xác minh bởi admin

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ default: false })
  allowPets: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  updatedBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  deletedBy?: Types.ObjectId;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// Indexes for performance
PropertySchema.index({ type: 1 });
PropertySchema.index({ staffIds: 1 });
PropertySchema.index({ isDeleted: 1 });
PropertySchema.index({ status: 1 });
PropertySchema.index({ isVerified: 1 });
PropertySchema.index({ 'location.place_id': 1 }); // Google Places ID index (highest priority)
PropertySchema.index({ 'location.lat': 1, 'location.lng': 1 }); // Basic lat/lng index
PropertySchema.index({ 'location.coordinates': '2dsphere' }); // 2dsphere index for geospatial queries
PropertySchema.index({ 'location.address': 'text', name: 'text' }); // Text search
PropertySchema.index({ createdAt: -1 });

// Middleware để tự động tạo coordinates từ lat/lng
PropertySchema.pre('save', function () {
  if (this.location && this.location.lat && this.location.lng) {
    this.location.coordinates = [this.location.lng, this.location.lat];
  }
});

PropertySchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as any;
  if (update.location && update.location.lat && update.location.lng) {
    update.location.coordinates = [update.location.lng, update.location.lat];
  }
});

// Hide sensitive fields in JSON response
PropertySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
