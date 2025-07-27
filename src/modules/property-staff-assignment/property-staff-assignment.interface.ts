import { Types } from 'mongoose';
import { AssignmentStatus } from './schemas/property-staff-assignment.schema';

export interface IPropertyStaffAssignment {
  _id?: Types.ObjectId;
  propertyId: Types.ObjectId;
  staffId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  status: AssignmentStatus;
  assignedAt: Date;
  unassignedAt?: Date;
  unassignedBy?: Types.ObjectId;
  notes?: string;
  unassignNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAssignStaffPayload {
  propertyId: Types.ObjectId;
  staffId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  notes?: string;
}

export interface IUnassignStaffPayload {
  propertyId: Types.ObjectId;
  staffId: Types.ObjectId;
  unassignedBy: Types.ObjectId;
  unassignNotes?: string;
}
