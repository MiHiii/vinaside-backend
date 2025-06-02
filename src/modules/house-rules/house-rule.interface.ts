import { Types } from 'mongoose';

export interface IHouseRule {
  name: string;
  description?: string;
  icon_url?: string;
  default_checked: boolean;
  is_active: boolean;
  isDeleted?: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
  created_at?: Date;
  updated_at?: Date;
} 