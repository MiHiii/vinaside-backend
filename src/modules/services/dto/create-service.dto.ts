import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Min,
  IsUrl,
} from 'class-validator';

export class CreateServiceDto {
  @IsString({ message: 'Tên dịch vụ phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Tên dịch vụ không được để trống' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi văn bản' })
  description?: string;

  @IsString({ message: 'Đơn vị phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Đơn vị không được để trống' })
  unit: string;

  @IsNumber({}, { message: 'Giá mặc định phải là số' })
  @Min(0, { message: 'Giá mặc định phải từ 0 trở lên' })
  default_price: number;

  @IsOptional()
  @IsString({ message: 'URL icon phải là chuỗi văn bản' })
  @IsUrl({}, { message: 'URL icon phải có định dạng hợp lệ' })
  icon_url?: string;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  is_active?: boolean = true;
}
