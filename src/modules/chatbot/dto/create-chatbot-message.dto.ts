import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateChatbotMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsMongoId({ message: 'user_id must be a valid MongoDB ObjectId' })
  user_id?: string;
}
