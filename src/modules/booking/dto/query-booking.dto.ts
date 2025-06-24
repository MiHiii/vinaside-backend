import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
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
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @IsOptional()
  @IsMongoId()
  listingId?: string;

  @IsOptional()
  @IsMongoId()
  guestId?: string;

  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  checkInFrom?: string;

  @IsOptional()
  @IsDateString()
  checkInTo?: string;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean = false;
}
