import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Service extends Document {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  description?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  icon_url?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    default: '/ngày',
  })
  unit: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  default_price: number;

  @Prop({
    type: Boolean,
    required: true,
    default: true,
  })
  is_active: boolean;

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

export const ServiceSchema = SchemaFactory.createForClass(Service);

// Indexes
ServiceSchema.index({ name: 1 });
ServiceSchema.index({ is_active: 1 });
ServiceSchema.index({ isDeleted: 1 });
ServiceSchema.index({ created_at: -1 });
