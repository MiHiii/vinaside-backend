import { PartialType } from '@nestjs/mapped-types';
import { CreateVoucherDto } from './create-voucher.dto';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Số lượt đã sử dụng không được âm' })
  uses_count?: number;
}
