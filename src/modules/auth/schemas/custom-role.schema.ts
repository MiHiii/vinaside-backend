import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomRoleDocument = CustomRole & Document;

@Schema({ timestamps: true })
export class CustomRole {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const CustomRoleSchema = SchemaFactory.createForClass(CustomRole);

// Indexes for performance
CustomRoleSchema.index({ key: 1 });
CustomRoleSchema.index({ isDeleted: 1 });
CustomRoleSchema.index({ createdAt: -1 });

// Hide sensitive fields in JSON response
CustomRoleSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
