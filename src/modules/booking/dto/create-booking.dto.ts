import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBookingDto {
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
  guests: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  infants?: number = 0;

  @IsString()
  @IsOptional()
  specialRequests?: string;
}
