import { Document, Types } from 'mongoose';

export interface ServiceInterface extends Document {
  readonly _id: Types.ObjectId;
  readonly name: string;
  readonly description?: string;
  readonly unit: string;
  readonly default_price: number;
  readonly is_active: boolean;
  readonly isDeleted: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly createdBy?: Types.ObjectId;
  readonly updatedBy?: Types.ObjectId;
  readonly deletedBy?: Types.ObjectId;
  readonly deletedAt?: Date;
}

export interface PaginatedServices {
  services: ServiceInterface[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
