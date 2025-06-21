import { IsString, IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';

export class SocketMessageDto {
  @IsString()
  @IsMongoId({ message: 'sender_id must be a valid MongoDB ObjectId' })
  sender_id: string;

  @IsString()
  @IsMongoId({ message: 'receiver_id must be a valid MongoDB ObjectId' })
  receiver_id: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;
}
