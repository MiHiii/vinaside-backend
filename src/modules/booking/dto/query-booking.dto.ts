import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsMongoId,
  Min,
  Max,
} from 'class-validator';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class QueryBookingDto {
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
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  includeDeleted?: boolean = false;

  @IsOptional()
  @IsMongoId()
  guest_id?: string;

  @IsOptional()
  @IsMongoId()
  host_id?: string;

  @IsOptional()
  @IsMongoId()
  listing_id?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  check_in_from?: string;

  @IsOptional()
  @IsDateString()
  check_in_to?: string;

  @IsOptional()
  @IsDateString()
  check_out_from?: string;

  @IsOptional()
  @IsDateString()
  check_out_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount_from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount_to?: number;

  @IsOptional()
  @IsString()
  guest_name?: string;

  @IsOptional()
  @IsString()
  guest_email?: string;

  @IsOptional()
  @IsString()
  guest_phone?: string;
}
