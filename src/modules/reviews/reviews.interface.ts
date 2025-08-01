import { Types } from 'mongoose';

export interface IReview {
  _id?: Types.ObjectId;
  user_id: Types.ObjectId;
  property_id: Types.ObjectId;
  room_id: Types.ObjectId;
  rating: number;
  comment: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IReviewStatistics {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [rating: number]: number };
}

export interface IReviewFilters {
  user_id?: string;
  property_id?: string;
  room_id?: string;
  rating?: number;
  keyword?: string;
}
