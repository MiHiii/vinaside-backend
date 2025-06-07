import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  ValidateNested,
  Min,
  ArrayMinSize,
  IsNotEmpty,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import {
  PropertyType,
  CancelPolicy,
  ListingStatus,
} from '../schemas/listing.schema';

class LocationDto {
  @IsString()
  @IsNotEmpty()
  type: string = 'Point';

  @IsArray()
  @ArrayMinSize(2)
  @IsLongitude({ message: 'First coordinate must be a valid longitude' })
  @IsLatitude({ message: 'Second coordinate must be a valid latitude' })
  coordinates: [number, number];
}

export class UpdateListingDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  building_name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  images?: string[];

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  address?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_night?: number;

  @IsEnum(PropertyType)
  @IsOptional()
  property_type?: PropertyType;

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
  @Min(0.5)
  @IsOptional()
  bathrooms?: number;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  house_rules_selected?: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  safety_features?: string[];

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  check_in_time?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  check_out_time?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  other_rules?: string[];

  @IsEnum(CancelPolicy)
  @IsOptional()
  cancel_policy?: CancelPolicy;

  @IsBoolean()
  @IsOptional()
  allow_pets?: boolean;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;

  @IsNumber()
  @IsOptional()
  average_rating?: number;

  @IsNumber()
  @IsOptional()
  reviews_count?: number;
}
