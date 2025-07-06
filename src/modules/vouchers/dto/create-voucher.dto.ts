import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsMongoId,
  Min,
  Max,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, {
    message:
      'Mã voucher chỉ được chứa chữ hoa và số, không có khoảng trắng hoặc dấu',
  })
  code: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Phần trăm giảm giá phải từ 1% trở lên' })
  @Max(50, { message: 'Phần trăm giảm giá không được vượt quá 50%' })
  discount_percent: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Số lượt sử dụng tối đa phải từ 1 trở lên' })
  max_uses: number;

  @IsDateString({}, { message: 'Ngày hết hạn phải có định dạng hợp lệ' })
  expiration_date: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Giá trị đơn hàng tối thiểu phải từ 0 trở lên' })
  min_order_value?: number = 0;

  @IsOptional()
  @IsMongoId()
  property_id?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  room_ids?: string[];
}
