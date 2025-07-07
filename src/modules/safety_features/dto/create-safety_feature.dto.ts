import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSafetyFeatureDto {
  @ApiProperty({
    description: 'Tên của tính năng an toàn',
    example: 'Khóa cửa thông minh',
    maxLength: 255,
  })
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tên không được vượt quá 255 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết về tính năng an toàn',
    example: 'Hệ thống khóa cửa thông minh với mã PIN và thẻ từ',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Có được chọn mặc định khi tạo booking không',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'default_checked phải là giá trị boolean' })
  default_checked?: boolean = false;
}
