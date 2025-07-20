import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsMongoId()
  @IsOptional()
  voucher_id?: string;
}
