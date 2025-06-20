import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsString()
  @Transform(({ value, obj }): string => {
    if (typeof value === 'string') return value;
    if (obj && typeof obj === 'object' && 'senderId' in obj && typeof obj.senderId === 'string') {
      return obj.senderId;
    }
    return '';
  })
  sender_id: string;

  @IsString()
  @Transform(({ value, obj }): string => {
    if (typeof value === 'string') return value;
    if (obj && typeof obj === 'object' && 'receiverId' in obj && typeof obj.receiverId === 'string') {
      return obj.receiverId;
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
