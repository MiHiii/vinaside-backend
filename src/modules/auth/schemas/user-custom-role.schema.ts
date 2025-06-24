import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserCustomRoleDocument = UserCustomRole & Document;

@Schema({ timestamps: true })
export class UserCustomRole {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CustomRole', required: true })
  customRoleId: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const UserCustomRoleSchema =
  SchemaFactory.createForClass(UserCustomRole);

// Compound indexes for performance and uniqueness
UserCustomRoleSchema.index({ userId: 1, customRoleId: 1 }, { unique: true });
UserCustomRoleSchema.index({ userId: 1 });
UserCustomRoleSchema.index({ customRoleId: 1 });
UserCustomRoleSchema.index({ isDeleted: 1 });
UserCustomRoleSchema.index({ createdAt: -1 });

// Hide sensitive fields in JSON response
UserCustomRoleSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
