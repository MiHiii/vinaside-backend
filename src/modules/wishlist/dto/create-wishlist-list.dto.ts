import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateWishlistListDto {
  @IsMongoId()
  @IsOptional()
  user_id?: string;

  @IsString({ message: 'Tên danh sách phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên danh sách không được để trống' })
  @MinLength(1, { message: 'Tên danh sách phải có ít nhất 1 ký tự' })
  @MaxLength(100, { message: 'Tên danh sách không được vượt quá 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;
}
