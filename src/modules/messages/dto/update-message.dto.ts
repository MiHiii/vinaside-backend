import { PartialType } from '@nestjs/mapped-types';
import { CreateMessageDto } from './create-message.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { MessageStatus } from '../schemas/message.schema';

export class UpdateMessageDto extends PartialType(CreateMessageDto) {
  @IsOptional()
  @IsEnum(MessageStatus)
  is_read?: MessageStatus;
}
