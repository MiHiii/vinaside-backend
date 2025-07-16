import { PartialType } from '@nestjs/mapped-types';
import { CreateVoucherDto } from './create-voucher.dto';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Số lượt đã sử dụng không được âm' })
  uses_count?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Giá trị đơn hàng tối thiểu phải từ 0 trở lên' })
  min_order_value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Số lần sử dụng tối đa mỗi user phải từ 1 trở lên' })
  @Max(10, { message: 'Số lần sử dụng tối đa mỗi user không được vượt quá 10' })
  max_uses_per_user?: number;
}
