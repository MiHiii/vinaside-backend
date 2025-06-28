import {
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryServiceDto {
  @IsOptional()
  @IsNumber({}, { message: 'Trang phải là số' })
  @Min(1, { message: 'Trang phải từ 1 trở lên' })
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @IsNumber({}, { message: 'Limit phải là số' })
  @Min(1, { message: 'Limit phải từ 1 trở lên' })
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'Tên dịch vụ phải là chuỗi văn bản' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị phải là chuỗi văn bản' })
  unit?: string;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  @Transform(({ value }: { value: string | boolean }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  is_active?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Bao gồm đã xóa phải là boolean' })
  @Transform(({ value }: { value: string | boolean }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  include_deleted?: boolean = false;

  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi văn bản' })
  search?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Giá tối thiểu phải là số' })
  @Transform(({ value }: { value: string }) => parseFloat(value))
  min_price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Giá tối đa phải là số' })
  @Transform(({ value }: { value: string }) => parseFloat(value))
  max_price?: number;
}
