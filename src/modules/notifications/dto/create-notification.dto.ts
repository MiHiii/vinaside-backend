import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsArray,
  IsBoolean,
  IsObject,
} from 'class-validator';
import {
  NotificationType,
  RecipientType,
  SentMethod,
  NotificationStatus,
} from '../schemas/notification.schema';

export class CreateNotificationDto {
  @IsString()
  @IsMongoId({ message: 'user_id must be a valid MongoDB ObjectId' })
  user_id: string;

  @IsEnum(RecipientType, { message: 'Invalid recipient type' })
  recipient_type: RecipientType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType, { message: 'Invalid notification type' })
  type: NotificationType;

  @IsOptional()
  @IsString()
  @IsMongoId({
    message: 'notification_template_id must be a valid MongoDB ObjectId',
  })
  notification_template_id?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SentMethod, { each: true, message: 'Invalid sent method' })
  sent_method?: SentMethod[];

  @IsOptional()
  @IsEnum(NotificationStatus, { message: 'Invalid notification status' })
  status?: NotificationStatus;

  @IsOptional()
  @IsBoolean()
  is_read?: boolean;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  sender_user_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
