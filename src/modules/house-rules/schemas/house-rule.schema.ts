import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type HouseRuleDocument = HouseRule & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class HouseRule extends Document {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  })
  name: string;

  @Prop({
    type: String,
    trim: true,
    maxlength: 500,
  })
  description?: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  default_checked: boolean;

  @Prop({
    type: Boolean,
    default: true,
    index: true,
  })
  is_active: boolean;

  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isDeleted: boolean;

  // Timestamps and user tracking
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  deletedBy?: Types.ObjectId;

  @Prop({ type: Date })
  deletedAt?: Date;

  // Auto-generated timestamps
  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;
}

export const HouseRuleSchema = SchemaFactory.createForClass(HouseRule);

// Compound indexes for better query performance
HouseRuleSchema.index({ name: 1, isDeleted: 1 });
HouseRuleSchema.index({ is_active: 1, isDeleted: 1 });
HouseRuleSchema.index({ created_at: -1 });
HouseRuleSchema.index({ name: 'text', description: 'text' }); // For text search
