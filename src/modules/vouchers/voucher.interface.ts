import { Document, Types } from 'mongoose';

export interface IVoucher extends Document {
  _id: Types.ObjectId;
  code: string;
  discount_percent: number;
  max_uses: number;
  uses_count: number;
  expiration_date: Date;
  is_active: boolean;
  description?: string;
  applies_to?: {
    room_ids?: Types.ObjectId[];
  };
  isDeleted: boolean;
  created_at: Date;
  updated_at: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
}
