import { Types } from 'mongoose';

export interface IService {
  _id: any; // Using any to match mongoose Document type
  name: string;
  description?: string;
  icon_url?: string;
  unit: string;
  default_price: number;
  is_active: boolean;
  property_id: Types.ObjectId;
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
