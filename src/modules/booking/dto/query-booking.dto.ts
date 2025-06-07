import {
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  IsMongoId,
  IsBoolean,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '../schemas/booking.schema';

export class QueryBookingDto {
  @IsOptional()
  @IsMongoId()
  guestId?: string;

  @IsOptional()
  @IsMongoId()
  hostId?: string;

  @IsOptional()
  @IsMongoId()
  listingId?: string;

  @IsOptional()
  @IsDateString()
  checkInFrom?: string;

  @IsOptional()
  @IsDateString()
  checkInTo?: string;

  @IsOptional()
  @IsDateString()
  checkOutFrom?: string;

  @IsOptional()
  @IsDateString()
  checkOutTo?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PayoutStatus)
  payoutStatus?: PayoutStatus;

  @IsOptional()
  @IsEnum(RefundStatus)
  refundStatus?: RefundStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean;

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
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
