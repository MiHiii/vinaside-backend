import { PartialType } from '@nestjs/mapped-types';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  cancellation_reason?: string;

  @IsOptional()
  @IsDateString()
  cancelled_at?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  service_fee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  final_amount?: number;
}
