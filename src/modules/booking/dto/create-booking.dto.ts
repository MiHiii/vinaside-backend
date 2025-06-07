import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  IsMongoId,
  IsEnum,
  IsString,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class CreateBookingDto {
  @IsNotEmpty()
  @IsMongoId()
  guestId: string;

  @IsNotEmpty()
  @IsMongoId()
  hostId: string;

  @IsNotEmpty()
  @IsMongoId()
  listingId: string;

  @IsNotEmpty()
  @IsDateString()
  checkIn: string;

  @IsNotEmpty()
  @IsDateString()
  checkOut: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  totalPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number = 0.1;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  finalPayoutAmount?: number;

  @IsOptional()
  @IsString()
  guestNote?: string;

  @IsOptional()
  @IsMongoId()
  paymentId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
