import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsString()
  @Transform(({ value, obj }) => {
    return value || obj.senderId;
  })
  sender_id: string;

  @IsString()
  @Transform(({ value, obj }) => {
    return value || obj.receiverId;
  })
  receiver_id: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;
}
