import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateServiceDto {
  @ApiProperty({
    example: 'WiFi miễn phí',
    description: 'Tên dịch vụ',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Kết nối internet tốc độ cao',
    description: 'Mô tả dịch vụ',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '/ngày',
    description: 'Đơn vị tính',
    required: false,
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({
    example: 50000,
    description: 'Giá mặc định',
    minimum: 0,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  default_price?: number;

  @ApiProperty({
    example: true,
    description: 'Trạng thái hoạt động',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({
    example: 'https://example.com/icon.png',
    description: 'Đường dẫn icon của dịch vụ',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon_url?: string;
}
