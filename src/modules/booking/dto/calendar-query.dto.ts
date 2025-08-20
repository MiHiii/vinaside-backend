import {
  IsOptional,
  IsString,
  IsDateString,
  IsMongoId,
  IsEnum,
} from 'class-validator';

export enum CalendarViewType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  TODAY = 'today',
  // Aliases for convenience
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class CalendarQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @IsOptional()
  @IsMongoId()
  listingId?: string;

  @IsOptional()
  @IsEnum(CalendarViewType)
  viewType?: CalendarViewType = CalendarViewType.MONTHLY;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  payment_status?: string;

  // Optional name-based search for calendar
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsString()
  listingTitle?: string;

  @IsOptional()
  @IsString()
  propertyName?: string;
}
