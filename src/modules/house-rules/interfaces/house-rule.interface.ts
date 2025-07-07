import { Types } from 'mongoose';

export interface IHouseRule {
  _id?: Types.ObjectId | string;
  name: string;
  description?: string;
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

export interface IHouseRuleResponse {
  houseRules: IHouseRule[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface IHouseRuleFilters {
  is_active?: boolean;
  isDeleted?: boolean;
  search?: string;
}

export interface IHouseRuleSort {
  field: 'name' | 'created_at' | 'updated_at' | 'is_active';
  order: 'asc' | 'desc';
}

export interface IHouseRuleStatistics {
  total: number;
  active: number;
  inactive: number;
  defaultChecked: number;
  deleted: number;
  createdToday: number;
  createdThisWeek: number;
  createdThisMonth: number;
  byStatus: {
    active: number;
    inactive: number;
  };
  byDefaultStatus: {
    defaultChecked: number;
    notDefaultChecked: number;
  };
  recentActivity: {
    date: string;
    count: number;
  }[];
  topCreators: {
    userId: string;
    count: number;
  }[];
}

export interface IHouseRuleStatsQuery {
  period?: 'day' | 'week' | 'month' | 'year';
  includeDeleted?: boolean;
  includeRecentActivity?: boolean;
  includeTopCreators?: boolean;
}
