import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';

export class CreateReviewDto {
  @IsString({ message: 'room_id phải là chuỗi' })
  @IsNotEmpty({ message: 'room_id không được để trống' })
  @IsMongoId({ message: 'room_id phải là ObjectId hợp lệ' })
  room_id: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'rating phải là số' })
  @IsNotEmpty({ message: 'rating không được để trống' })
  @Min(1, { message: 'rating phải từ 1 đến 5' })
  @Max(5, { message: 'rating phải từ 1 đến 5' })
  rating: number;

  @IsString({ message: 'comment phải là chuỗi' })
  @IsNotEmpty({ message: 'comment không được để trống' })
  comment: string;
}
