import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from 'src/modules/users/schemas/user.schema';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true, ref: User.name, type: MongooseSchema.Types.ObjectId })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  revoked: boolean;

  @Prop({ type: Object })
  deviceInfo: {
    userAgent?: string;
    ip?: string;
    description?: string;
  };

  // Thêm createdAt và updatedAt từ timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Thêm virtual field isActive
RefreshTokenSchema.virtual('isActive').get(function (
  this: RefreshTokenDocument,
) {
  return !this.revoked && this.expiresAt > new Date();
});

// Đảm bảo virtual fields được trả về khi convert sang JSON
RefreshTokenSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.__v;
    return ret;
  },
});

// Thêm index để tối ưu tìm kiếm và cronjob xóa
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 });
RefreshTokenSchema.index({ revoked: 1, expiresAt: 1 });
