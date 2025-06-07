import {
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsEnum,
  IsString,
  IsPositive,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
} from '../schemas/booking.schema';

export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  totalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number;

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
  @IsMongoId()
  payoutId?: string;

  @IsOptional()
  @IsEnum(PayoutStatus)
  payoutStatus?: PayoutStatus;

  @IsOptional()
  @IsString()
  payoutNote?: string;

  @IsOptional()
  @IsMongoId()
  refundId?: string;

  @IsOptional()
  @IsEnum(RefundStatus)
  refundStatus?: RefundStatus;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
