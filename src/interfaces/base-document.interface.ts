import { Types } from 'mongoose';

// Interface for Mongoose documents
export interface BaseDocument {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
}
