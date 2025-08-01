import {
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class BookingServiceDto {
  @IsString()
  serviceId: string;

  @IsNumber()
  quantity: number;
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
}
