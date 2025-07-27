import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyStaffAssignmentDocument = PropertyStaffAssignment &
  Document;

export enum AssignmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Schema({ timestamps: true })
export class PropertyStaffAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  staffId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedBy: Types.ObjectId; // ID của người assign (admin/manager)

  @Prop({
    type: String,
    enum: AssignmentStatus,
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @Prop({ type: Date, default: Date.now })
  assignedAt: Date;

  @Prop({ type: Date })
  unassignedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  unassignedBy?: Types.ObjectId; // ID của người unassign

  @Prop()
  notes?: string; // Ghi chú về việc assign

  @Prop()
  unassignNotes?: string; // Ghi chú về việc unassign

  // Index compound để đảm bảo một staff chỉ có thể được assign một lần cho một property (với status active)
  // Sẽ được định nghĩa trong schema factory
}

export const PropertyStaffAssignmentSchema = SchemaFactory.createForClass(
  PropertyStaffAssignment,
);

// Tạo index compound
PropertyStaffAssignmentSchema.index(
  { propertyId: 1, staffId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: AssignmentStatus.ACTIVE },
  },
);

// Index để tìm kiếm nhanh theo property
PropertyStaffAssignmentSchema.index({ propertyId: 1, status: 1 });

// Index để tìm kiếm nhanh theo staff
PropertyStaffAssignmentSchema.index({ staffId: 1, status: 1 });
