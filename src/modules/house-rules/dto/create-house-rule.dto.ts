import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHouseRuleDto {
  @ApiProperty({
    description: 'Tên quy tắc nhà',
    example: 'Không hút thuốc',
  })
  @IsString({ message: 'Tên quy tắc nhà phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên quy tắc nhà không được để trống' })
  @MaxLength(100, { message: 'Tên quy tắc nhà không được vượt quá 100 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả chi tiết quy tắc nhà',
    example: 'Tuyệt đối không được hút thuốc trong phòng và khu vực chung',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Quy tắc có được chọn mặc định khi tạo listing không',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Default checked phải là boolean' })
  default_checked?: boolean = false;
}
