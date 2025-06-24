import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Unique key for the permission',
    example: 'listing.verify',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @ApiProperty({
    description: 'Module name',
    example: 'listing',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  module: string;

  @ApiProperty({
    description: 'Action name',
    example: 'verify',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  action: string;

  @ApiPropertyOptional({
    description: 'Permission description',
    example: 'Duyệt bài đăng phòng',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
