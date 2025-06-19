import { Type, Transform } from 'class-transformer';
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
} from 'class-validator';
import {
  PropertyType,
  ListingStatus,
  CancelPolicy,
} from '../schemas/listing.schema';

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
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  includeDeleted?: boolean = false;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  place_id?: string;

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
  min_guests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  min_beds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  min_bathrooms?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  allow_pets?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
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
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  is_verified?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  guests?: number;

  // Flat geo parameters for search compatibility
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distance?: number;
}
