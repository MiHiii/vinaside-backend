import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingServiceDto {
  @IsMongoId()
  @IsNotEmpty()
  serviceId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number = 1;
}

export class CreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  propertyId: string;

  @IsMongoId()
  @IsNotEmpty()
  listingId: string;

  @IsDateString()
  @IsNotEmpty()
  checkInDate: string;

  @IsDateString()
  @IsNotEmpty()
  checkOutDate: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  guests: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  infants?: number = 0;

  @IsString()
  @IsOptional()
  specialRequests?: string;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceDto)
  @IsOptional()
  services?: BookingServiceDto[];
}
