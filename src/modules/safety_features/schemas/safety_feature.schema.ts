import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SafetyFeatureDocument = SafetyFeature & Document;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'safety_features',
})
export class SafetyFeature {
  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
    index: true,
  })
  name: string;

  @Prop({
    trim: true,
    maxlength: 1000,
  })
  description?: string;

  @Prop({
    required: true,
    trim: true,
  })
  icon_url: string;

  @Prop({
    default: true,
    index: true,
  })
  is_active: boolean;

  @Prop({
    default: false,
    index: true,
  })
  default_checked: boolean;

  @Prop({
    default: false,
    index: true,
  })
  isDeleted: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
  })
  deletedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  created_at?: Date;
  updated_at?: Date;
}

export const SafetyFeatureSchema = SchemaFactory.createForClass(SafetyFeature);

// Indexes for performance
SafetyFeatureSchema.index({ name: 1, isDeleted: 1 });
SafetyFeatureSchema.index({ is_active: 1, isDeleted: 1 });
SafetyFeatureSchema.index({ default_checked: 1, isDeleted: 1 });
SafetyFeatureSchema.index({ createdBy: 1, isDeleted: 1 });
SafetyFeatureSchema.index({ name: 'text', description: 'text' });
