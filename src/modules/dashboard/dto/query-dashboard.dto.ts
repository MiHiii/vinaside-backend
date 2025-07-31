import { IsOptional, IsString, IsMongoId } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryDashboardDto {
  @ApiPropertyOptional({ description: 'Start date for filtering (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Property ID for filtering' })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Group by time period' })
  @IsOptional()
  @IsString()
  groupBy?: string;
}
