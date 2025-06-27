import {
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  IsBoolean,
  IsMongoId,
  ArrayMinSize,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class PriceRangeQueryDto {
  @IsOptional()
  @IsNumber({}, { message: 'Giá tối thiểu phải là số hợp lệ' })
  @Min(0, { message: 'Giá tối thiểu phải từ 0 trở lên' })
  @Transform(({ value }) => parseFloat(value))
  min_price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá tối đa phải là số hợp lệ' })
  @Min(0, { message: 'Giá tối đa phải từ 0 trở lên' })
  @Transform(({ value }) => parseFloat(value))
  max_price?: number;
}

export class BulkUpdateStatusDto {
  @IsArray({ message: 'Danh sách ID phải là mảng' })
  @ArrayMinSize(1, { message: 'Danh sách ID không được để trống' })
  @IsMongoId({ each: true, message: 'Mỗi ID phải là ObjectId hợp lệ' })
  ids: string[];

  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  is_active: boolean;
}
