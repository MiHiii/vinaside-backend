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
import { CancelPolicy } from '../schemas/listing.schema';

export class CreateListingDto {
  @IsMongoId()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  images: string[];

  @IsNumber()
  @Min(0)
  price_per_night: number;

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
  @Min(0)
  bathrooms: number;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  safety_features?: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  service_ids?: string[];

  @IsEnum(CancelPolicy)
  @IsOptional()
  cancel_policy?: CancelPolicy = CancelPolicy.FLEXIBLE;
}
