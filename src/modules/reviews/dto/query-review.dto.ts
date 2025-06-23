import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsMongoId,
  Min,
  Max,
} from 'class-validator';

export class QueryReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: string = 'desc';

  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @IsOptional()
  @IsMongoId()
  room_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}
