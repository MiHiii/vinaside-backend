import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PermissionDocument = Permission & Document;

@Schema({ timestamps: true })
export class Permission {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  module: string;

  @Prop({ required: true })
  action: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Indexes for performance
PermissionSchema.index({ key: 1 });
PermissionSchema.index({ module: 1, action: 1 });
PermissionSchema.index({ isDeleted: 1 });
PermissionSchema.index({ createdAt: -1 });

// Hide sensitive fields in JSON response
PermissionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
