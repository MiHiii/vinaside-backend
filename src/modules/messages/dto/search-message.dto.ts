import { IsOptional, IsString, IsMongoId } from 'class-validator';

export class SearchMessageDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsMongoId()
  sender_id?: string;

  @IsOptional()
  @IsMongoId()
  receiver_id?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}
