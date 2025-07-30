import { IsString, IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';

export class CreateMessageDto {
  @IsString()
  @IsMongoId({ message: 'receiver_id must be a valid MongoDB ObjectId' })
  receiver_id: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsMongoId({ message: 'property_id must be a valid MongoDB ObjectId' })
  property_id?: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;

  @IsOptional()
  @IsString()
  @IsMongoId({
    message: 'reply_to_message_id must be a valid MongoDB ObjectId',
  })
  reply_to_message_id?: string;
}
