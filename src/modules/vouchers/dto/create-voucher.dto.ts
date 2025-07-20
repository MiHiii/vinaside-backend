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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoucherDto {
  @ApiProperty({
    description: 'Mã voucher',
    example: 'SUMMER2024',
    pattern: '^[A-Z0-9]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, {
    message:
      'Mã voucher chỉ được chứa chữ hoa và số, không có khoảng trắng hoặc dấu',
  })
  code: string;

  @ApiProperty({
    description: 'Phần trăm giảm giá',
    example: 15,
    minimum: 1,
    maximum: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Phần trăm giảm giá phải từ 1% trở lên' })
  @Max(50, { message: 'Phần trăm giảm giá không được vượt quá 50%' })
  discount_percent: number;

  @ApiProperty({
    description: 'Số lượt sử dụng tối đa',
    example: 100,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Số lượt sử dụng tối đa phải từ 1 trở lên' })
  max_uses: number;

  @ApiProperty({
    description: 'Ngày hết hạn',
    example: '2024-12-31T23:59:59.000Z',
    format: 'date-time',
  })
  @IsDateString({}, { message: 'Ngày hết hạn phải có định dạng hợp lệ' })
  expiration_date: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @ApiPropertyOptional({
    description: 'Mô tả voucher',
    example: 'Giảm giá mùa hè cho tất cả phòng',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Giá trị đơn hàng tối thiểu',
    example: 500000,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Giá trị đơn hàng tối thiểu phải từ 0 trở lên' })
  min_order_value?: number = 0;

  @ApiPropertyOptional({
    description: 'Số lần tối đa mỗi user có thể sử dụng voucher',
    example: 1,
    minimum: 1,
    maximum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Số lần sử dụng tối đa mỗi user phải từ 1 trở lên' })
  @Max(1, { message: 'Số lần sử dụng tối đa mỗi user không được vượt quá 1' })
  max_uses_per_user?: number = 1;

  @ApiPropertyOptional({
    description: 'ID property áp dụng',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  property_id?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID phòng áp dụng',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  room_ids?: string[];
}
