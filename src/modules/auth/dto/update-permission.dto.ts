import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePermissionDto {
  @ApiPropertyOptional({
    description: 'Module name',
    example: 'listing',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  module?: string;

  @ApiPropertyOptional({
    description: 'Action name',
    example: 'verify',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  action?: string;

  @ApiPropertyOptional({
    description: 'Permission description',
    example: 'Duyệt bài đăng phòng với quyền mở rộng',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
