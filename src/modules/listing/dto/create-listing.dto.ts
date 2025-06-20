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
} from 'class-validator';
import { PropertyType, CancelPolicy } from '../schemas/listing.schema';

class LocationDto {
  @IsString()
  @IsNotEmpty()
  type: string = 'Point';

  @IsArray()
  @ArrayMinSize(2)
  coordinates: [number, number];
}

export class CreateListingDto {
  @IsMongoId()
  @IsOptional()
  host_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  building_name?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  images: string[];

  @IsString()
  @IsNotEmpty()
  address: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsNumber()
  @Min(0)
  price_per_night: number;

  @IsEnum(PropertyType)
  property_type: PropertyType;

  @IsNumber()
  @IsOptional()
  @Min(1)
  guests?: number = 2;

  @IsNumber()
  @Min(1)
  max_guests: number;

  @IsBoolean()
  @IsOptional()
  allow_infants?: boolean = false;

  @IsNumber()
  @IsOptional()
  @Min(0)
  max_infants?: number = 0;

  @IsNumber()
  @Min(1)
  beds: number;

  @IsNumber()
  @Min(0.5)
  bathrooms: number;

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
  check_in_time: string;

  @IsString()
  @IsNotEmpty()
  check_out_time: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  other_rules?: string[];

  @IsEnum(CancelPolicy)
  @IsOptional()
  cancel_policy?: CancelPolicy = CancelPolicy.FLEXIBLE;

  @IsBoolean()
  @IsOptional()
  allow_pets?: boolean = false;
}
