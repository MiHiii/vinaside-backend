import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryVoucherDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  expiration_date_from?: string;

  @IsOptional()
  @IsDateString()
  expiration_date_to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  include_deleted?: boolean = false;

  @IsOptional()
  @IsString()
  property_id?: string;

  @IsOptional()
  @IsString()
  room_id?: string;
}
