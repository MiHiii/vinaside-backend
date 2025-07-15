import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryUserDto {
  @ApiProperty({
    required: false,
    description: 'Tìm kiếm theo tên, email hoặc phone',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Số trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, description: 'Số lượng mỗi trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Sắp xếp',
    example: 'createdAt:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt:desc';

  @ApiProperty({ required: false, description: 'Lọc theo vai trò' })
  @IsOptional()
  @IsEnum(['guest', 'staff', 'admin'], { each: true })
  role?: string | string[];

  @ApiProperty({ required: false, description: 'Trạng thái xác minh email' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    return undefined; // Return undefined for invalid values
  })
  is_verified?: boolean;

  @ApiProperty({
    required: false,
    description: 'Trạng thái tài khoản (bị xóa hay không)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    return undefined; // Return undefined for invalid values
  })
  isDeleted?: boolean;

  @IsOptional()
  @IsString()
  select?: string;
}
