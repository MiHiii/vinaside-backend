import {
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsObject,
  ValidateNested as ValidateNestedObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class BookingServiceDto {
  @IsString()
  serviceId: string;

  @IsNumber()
  quantity: number;
}

export class CancellationDetailsDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  refundNote?: string;
}

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceDto)
  @IsOptional()
  selected_services?: BookingServiceDto[];

  @IsNumber()
  @IsOptional()
  services_total_amount?: number;

  @IsNumber()
  @IsOptional()
  final_amount?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  additionalCost?: number;

  @IsString()
  @IsOptional()
  additionalCostReason?: string;

  @IsObject()
  @ValidateNestedObject()
  @Type(() => CancellationDetailsDto)
  @IsOptional()
  cancellationDetails?: CancellationDetailsDto;
}

export class UpdateCancellationDetailsDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  refundNote?: string;
}
