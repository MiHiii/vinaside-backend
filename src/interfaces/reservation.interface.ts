import { Types } from 'mongoose';

export interface IReservation {
  title: string;
  description?: string;
  date: Date;
  status?: string;
  user: Types.ObjectId;
}
