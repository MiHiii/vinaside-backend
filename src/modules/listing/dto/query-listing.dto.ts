import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsMongoId,
  Min,
  Max,
} from 'class-validator';
import { ListingStatus, CancelPolicy } from '../schemas/listing.schema';

export class QueryListingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsEnum(CancelPolicy)
  cancel_policy?: CancelPolicy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  guests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  min_beds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_bathrooms?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  allow_infants?: boolean;

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
  @Transform(({ value }) => value === 'true' || value === true)
  is_verified?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isDeleted?: boolean;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minViewCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxViewCount?: number;

  // Location filters (Priority: place_id > city/district/ward > address > geospatial)
  @IsOptional()
  @IsString()
  place_id?: string; // Google Places ID - highest priority

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  fuzzy_place_search?: boolean; // Enable fuzzy search for place_id (default: true)

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Geospatial search
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radius?: number = 10; // Default 10km radius

  // Location keyword search (tìm kiếm gần đúng theo tất cả fields location)
  @IsOptional()
  @IsString()
  locationKeyword?: string;
}
