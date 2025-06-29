import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAmenityDto {
  @ApiProperty({
    description: 'Tên tiện ích',
    example: 'WiFi miễn phí',
  })
  @IsString({ message: 'Tên tiện ích phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên tiện ích không được để trống' })
  @MaxLength(100, { message: 'Tên tiện ích không được vượt quá 100 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết tiện ích',
    example: 'Internet tốc độ cao miễn phí cho tất cả khách hàng',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    description: 'URL icon cho tiện ích',
    example: 'https://example.com/wifi-icon.png',
  })
  @IsOptional()
  @IsString({ message: 'URL icon phải là chuỗi' })
  @IsUrl({}, { message: 'URL icon không hợp lệ' })
  icon_url?: string;

  @ApiPropertyOptional({
    description: 'Tiện ích có được chọn mặc định khi tạo listing không',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Default checked phải là boolean' })
  default_checked?: boolean = false;
}
