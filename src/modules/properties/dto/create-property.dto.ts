import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsEmail,
  IsPhoneNumber,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({ description: 'Latitude', example: 10.75 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 106.65 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({
    description: 'Full address',
    example: '123 Trần Phú, Vũng Tàu',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({ description: 'City', example: 'Vũng Tàu' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'District', example: 'Phường 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Ward', example: 'Phường Thắng Tam' })
  @IsOptional()
  @IsString()
  ward?: string;
}

export class CreatePropertyDto {
  @ApiProperty({ description: 'Property name', example: 'Villa Gió Biển' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Property type',
    enum: ['villa', 'homestay', 'apartment', 'resort', 'hotel'],
    example: 'villa',
  })
  @IsEnum(['villa', 'homestay', 'apartment', 'resort', 'hotel'])
  type: string;

  @ApiPropertyOptional({ description: 'Property description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Thumbnail image URL' })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Array of image URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ description: 'Property location' })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiPropertyOptional({ description: 'Property amenities' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Check-in time', example: '14:00' })
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @ApiPropertyOptional({ description: 'Check-out time', example: '12:00' })
  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @ApiPropertyOptional({ description: 'House rules' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  houseRules?: string[];

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsPhoneNumber('VN')
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Assigned staff IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  staffIds?: string[];

  @ApiPropertyOptional({
    description: 'Property status',
    enum: ['active', 'inactive', 'pending'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: string;

  @ApiPropertyOptional({ description: 'Is verified by admin' })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
