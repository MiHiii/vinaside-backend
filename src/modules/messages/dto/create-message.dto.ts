import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';
import { Transform } from 'class-transformer';

interface TransformObj {
  senderId?: string;
  receiverId?: string;
}

export class CreateMessageDto {
  @IsString()
  @Transform(({ value, obj }): string => {
    if (typeof value === 'string') return value;
    if (
      obj &&
      typeof obj === 'object' &&
      'senderId' in obj &&
      typeof (obj as TransformObj).senderId === 'string'
    ) {
      return (obj as TransformObj).senderId!;
    }
    return '';
  })
  sender_id: string;

  @IsString()
  @Transform(({ value, obj }): string => {
    if (typeof value === 'string') return value;
    if (
      obj &&
      typeof obj === 'object' &&
      'receiverId' in obj &&
      typeof (obj as TransformObj).receiverId === 'string'
    ) {
      return (obj as TransformObj).receiverId!;
    }
    return '';
  })
  receiver_id: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;
}
