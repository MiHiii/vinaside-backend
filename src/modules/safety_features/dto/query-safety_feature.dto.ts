import { Type, Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Helper function để transform boolean values
const transformBoolean = ({ value }: { value: any }): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    return value === 'true';
  }
  return Boolean(value);
};

export class QuerySafetyFeatureDto {
  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số trang phải là số' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng item trên mỗi trang',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit phải là số' })
  @Min(1, { message: 'Limit phải lớn hơn 0' })
  @Max(100, { message: 'Limit không được vượt quá 100' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Trường để sắp xếp',
    example: 'created_at',
    enum: ['name', 'created_at', 'updated_at', 'is_active', 'default_checked'],
  })
  @IsOptional()
  @IsString({ message: 'sortBy phải là chuỗi ký tự' })
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString({ message: 'sortOrder phải là chuỗi ký tự' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Có bao gồm các item đã xóa không',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'includeDeleted phải là giá trị boolean' })
  @Transform(transformBoolean)
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái xóa (true=đã xóa, false=chưa xóa)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isDeleted phải là boolean' })
  @Transform(transformBoolean)
  isDeleted?: boolean;

  @ApiPropertyOptional({
    description: 'Lọc theo tên tính năng an toàn',
    example: 'Khóa cửa',
  })
  @IsOptional()
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tên không được vượt quá 255 ký tự' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo mô tả',
    example: 'thông minh',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái hoạt động',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active phải là giá trị boolean' })
  @Transform(transformBoolean)
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái mặc định',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'default_checked phải là giá trị boolean' })
  @Transform(transformBoolean)
  default_checked?: boolean;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (tìm trong tên và mô tả)',
    example: 'khóa cửa thông minh',
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Từ khóa tìm kiếm không được vượt quá 255 ký tự' })
  search?: string;
}
