import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CancelPolicy, ListingStatus } from '../schemas/listing.schema';

export class UpdateListingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price_per_night?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  max_guests?: number;

  @IsBoolean()
  @IsOptional()
  allow_infants?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  max_infants?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  beds?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  bathrooms?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  house_rules_selected?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  safety_features?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  service_ids?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  voucher_ids?: string[];

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

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;

  // Weekend surcharge fields
  @IsBoolean()
  @IsOptional()
  has_weekend_surcharge?: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  weekend_surcharge_percent?: number;
}
