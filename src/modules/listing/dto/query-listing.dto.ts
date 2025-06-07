import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
  IsArray,
  IsMongoId,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import {
  PropertyType,
  ListingStatus,
  CancelPolicy,
} from '../schemas/listing.schema';

class GeoFilterDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  @Min(0)
  distance: number; // in kilometers
}

class PriceRangeDto {
  @IsNumber()
  @Min(0)
  min: number;

  @IsNumber()
  @Min(0)
  max: number;
}

export class QueryListingDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean = false;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsMongoId()
  host_id?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  property_type?: PropertyType;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsEnum(CancelPolicy)
  cancel_policy?: CancelPolicy;

  @IsOptional()
  @Type(() => GeoFilterDto)
  @ValidateNested()
  geo?: GeoFilterDto;

  @IsOptional()
  @Type(() => PriceRangeDto)
  @ValidateNested()
  price?: PriceRangeDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_guests?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  min_beds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  min_bathrooms?: number;

  @IsOptional()
  @IsBoolean()
  allow_pets?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_infants?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  available_from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  available_to?: Date;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  safety_features?: string[];

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;
}
