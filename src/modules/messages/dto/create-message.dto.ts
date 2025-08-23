import {
  IsMongoId,
  IsOptional,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  // Cách 1: gửi theo conversation có sẵn
  @IsOptional()
  @IsMongoId({ message: 'conversation_id must be a valid MongoDB ObjectId' })
  conversation_id?: string;

  // Cách 2: gửi theo cặp (property_id, guest_id)
  @ValidateIf((o: CreateMessageDto) => !o.conversation_id)
  @IsMongoId({ message: 'property_id must be a valid MongoDB ObjectId' })
  property_id?: string;

  // Khi staff gửi thì bắt buộc (check thêm ở Service)
  @IsOptional()
  @IsMongoId({ message: 'guest_id must be a valid MongoDB ObjectId' })
  guest_id?: string;

  // Optional: chỉ định receiver cụ thể
  @IsOptional()
  @IsMongoId({ message: 'receiver_id must be a valid MongoDB ObjectId' })
  receiver_id?: string;

  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  @IsString()
  @IsNotEmpty({ message: 'content is required' })
  @MaxLength(5000, { message: 'content is too long (max 5000 chars)' })
  content!: string;

  @IsOptional()
  @IsMongoId({
    message: 'reply_to_message_id must be a valid MongoDB ObjectId',
  })
  reply_to_message_id?: string;
}
