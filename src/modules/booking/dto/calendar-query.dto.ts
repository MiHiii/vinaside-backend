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
}
