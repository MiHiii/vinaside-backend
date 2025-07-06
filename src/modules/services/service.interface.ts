import { Types } from 'mongoose';

export interface IService {
  _id: any; // Using any to match mongoose Document type
  name: string;
  description?: string;
  unit: string;
  default_price: number;
  icon_url?: string;
  is_active: boolean;
  property_id: Types.ObjectId;
  room_id?: Types.ObjectId;
  isDeleted: boolean;
  created_at: Date;
  updated_at: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
}

export interface PaginatedServices {
  data: IService[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
