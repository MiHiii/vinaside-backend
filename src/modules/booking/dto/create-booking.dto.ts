import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  IsEmail,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  listing_id: string;

  @IsDateString()
  check_in_date: string;

  @IsDateString()
  check_out_date: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  guests: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  infants?: number = 0;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  guest_name?: string;

  @IsEmail()
  @IsOptional()
  guest_email?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  guest_phone?: string;

  @IsString()
  @IsOptional()
  special_requests?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;
}
