import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Display name for the role',
    example: 'Quản lý nội dung cập nhật',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Quản lý toàn bộ nội dung bài đăng với quyền mở rộng',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
