import { Types } from 'mongoose';

export interface IAmenity {
  _id?: Types.ObjectId | string;
  name: string;
  description?: string;
  icon_url?: string;
  default_checked: boolean;
  is_active: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IAmenityResponse {
  amenities: IAmenity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface IAmenityFilters {
  is_active?: boolean;
  isDeleted?: boolean;
  search?: string;
}

export interface IAmenitySort {
  field: 'name' | 'created_at' | 'updated_at' | 'is_active';
  order: 'asc' | 'desc';
}
