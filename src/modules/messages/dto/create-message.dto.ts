import { IsString, IsNotEmpty, IsMongoId, IsOptional, IsEnum } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';

export class CreateMessageDto {
  @IsMongoId()
  @IsNotEmpty()
  sender_id: string;

  @IsMongoId()
  @IsNotEmpty()
  receiver_id: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;
}
