import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomRolePermissionDocument = CustomRolePermission & Document;

@Schema({ timestamps: true })
export class CustomRolePermission {
  @Prop({ type: Types.ObjectId, ref: 'CustomRole', required: true })
  customRoleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Permission', required: true })
  permissionId: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const CustomRolePermissionSchema =
  SchemaFactory.createForClass(CustomRolePermission);

// Compound indexes for performance and uniqueness
CustomRolePermissionSchema.index(
  { customRoleId: 1, permissionId: 1 },
  { unique: true },
);
CustomRolePermissionSchema.index({ customRoleId: 1 });
CustomRolePermissionSchema.index({ permissionId: 1 });
CustomRolePermissionSchema.index({ isDeleted: 1 });
CustomRolePermissionSchema.index({ createdAt: -1 });

// Hide sensitive fields in JSON response
CustomRolePermissionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
