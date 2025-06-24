import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Unique key for the role',
    example: 'content_manager',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  key: string;

  @ApiProperty({
    description: 'Display name for the role',
    example: 'Quản lý nội dung',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Quản lý toàn bộ nội dung bài đăng',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
