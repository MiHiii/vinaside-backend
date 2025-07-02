import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPropertyDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search keyword in name or address' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Property type',
    enum: ['villa', 'homestay', 'apartment', 'resort', 'hotel'],
  })
  @IsOptional()
  @IsEnum(['villa', 'homestay', 'apartment', 'resort', 'hotel'])
  type?: string;

  @ApiPropertyOptional({
    description: 'Property status',
    enum: ['active', 'inactive', 'pending'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: string;

  @ApiPropertyOptional({ description: 'Is verified by admin' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'District name' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['name', 'createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: string = 'desc';

  // Geospatial search
  @ApiPropertyOptional({ description: 'Latitude for nearby search' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude for nearby search' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Radius in kilometers for nearby search',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radius?: number = 10;

  @ApiPropertyOptional({
    description: 'Property name (for exact or fuzzy search)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Property title (for exact or fuzzy search)',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
