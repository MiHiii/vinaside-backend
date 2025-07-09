import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Min,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString({ message: 'Tên dịch vụ phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Tên dịch vụ không được để trống' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi văn bản' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Icon URL phải là chuỗi văn bản' })
  icon_url?: string;

  @IsString({ message: 'Đơn vị phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Đơn vị không được để trống' })
  unit: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Giá mặc định phải là số' })
  @Min(0, { message: 'Giá mặc định phải từ 0 trở lên' })
  default_price: number;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  is_active?: boolean = true;

  @IsMongoId({ message: 'Property ID phải có định dạng hợp lệ' })
  property_id: string;
}
