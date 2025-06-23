import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { NotificationStatus } from '../schemas/notification.schema';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @IsOptional()
  @IsBoolean()
  is_read?: boolean;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
