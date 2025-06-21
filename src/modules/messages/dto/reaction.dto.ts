import { IsEnum, IsString, IsMongoId } from 'class-validator';
import { ReactionType } from '../schemas/message.schema';

export class AddReactionDto {
  @IsString()
  @IsMongoId({ message: 'message_id must be a valid MongoDB ObjectId' })
  message_id: string;

  @IsEnum(ReactionType, { message: 'Invalid reaction type' })
  type: ReactionType;
}

export class RemoveReactionDto {
  @IsString()
  @IsMongoId({ message: 'message_id must be a valid MongoDB ObjectId' })
  message_id: string;
}
