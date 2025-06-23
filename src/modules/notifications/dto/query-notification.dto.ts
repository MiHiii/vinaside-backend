import {
  IsOptional,
  IsEnum,
  IsNumberString,
  IsBooleanString,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  NotificationType,
  NotificationStatus,
} from '../schemas/notification.schema';

export class QueryNotificationDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsBooleanString()
  @Transform(({ value }) => value === 'true')
  is_read?: boolean;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsString()
  sort?: string;
}

export class AdminQueryNotificationDto extends QueryNotificationDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsBooleanString()
  @Transform(({ value }) => value === 'true')
  isDeleted?: boolean;
}
