import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({
    example: 'WiFi miễn phí',
    description: 'Tên dịch vụ',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

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
    default: '/ngày',
  })
  @IsString()
  @IsOptional()
  unit?: string = '/ngày';

  @ApiProperty({
    example: 50000,
    description: 'Giá mặc định',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  default_price: number;

  @ApiProperty({
    example: true,
    description: 'Trạng thái hoạt động',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

  @ApiProperty({
    example: 'https://example.com/icon.png',
    description: 'Đường dẫn icon của dịch vụ',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon_url?: string;
}
