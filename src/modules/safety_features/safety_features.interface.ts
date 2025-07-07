import { Types } from 'mongoose';

export interface ISafetyFeature {
  _id: string | Types.ObjectId;
  name: string;
  description?: string;
  is_active: boolean;
  default_checked: boolean;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ISafetyFeatureResponse {
  safetyFeatures: ISafetyFeature[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ISafetyFeatureFilters {
  name?: string;
  description?: string;
  is_active?: boolean;
  default_checked?: boolean;
  isDeleted?: boolean;
  createdBy?: string;
  search?: string;
}

export interface ISafetyFeatureSort {
  [key: string]: 1 | -1;
}
