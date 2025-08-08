import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DateRangeType {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  CUSTOM = 'custom',
}

export class QueryDashboardDto {
  @ApiPropertyOptional({
    description: 'Date range type for filtering',
    enum: DateRangeType,
    default: DateRangeType.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType = DateRangeType.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Start date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Property ID(s) for filtering. Can be single ID or comma-separated multiple IDs (e.g., "id1,id2,id3")',
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Group by time period' })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class RevenueChartDto {
  @ApiPropertyOptional({
    description: 'Date range type for revenue chart',
    enum: DateRangeType,
    default: DateRangeType.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType = DateRangeType.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Start date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom date range (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Property ID(s) for filtering. Can be single ID or comma-separated multiple IDs (e.g., "id1,id2,id3")',
  })
  @IsOptional()
  @IsString()
  propertyId?: string;
}
