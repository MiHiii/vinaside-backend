import {
  IsString,
  IsOptional,
  IsMongoId,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyStaffResponseDto {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  is_online?: boolean;
  last_seen?: Date;
}
