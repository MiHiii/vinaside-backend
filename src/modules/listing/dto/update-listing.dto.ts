import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  Min,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { CancelPolicy, ListingStatus } from '../schemas/listing.schema';

export class UpdateListingDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  images?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_night?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  guests?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  max_guests?: number;

  @IsBoolean()
  @IsOptional()
  allow_infants?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_infants?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  beds?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  safety_features?: string[];

  @IsEnum(CancelPolicy)
  @IsOptional()
  cancel_policy?: CancelPolicy;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;
}
