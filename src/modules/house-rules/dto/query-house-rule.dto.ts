import { Type, Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Helper function để transform boolean từ query params
const transformBoolean = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    const lowercaseValue = value.toLowerCase().trim();
    return lowercaseValue === 'true' || lowercaseValue === '1';
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return undefined;
};

export class QueryHouseRuleDto {
  @ApiPropertyOptional({
    description: 'Số trang',
    example: 1,
    default: 1,
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
    default: 10,
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
    default: 'created_at',
    enum: ['name', 'created_at', 'updated_at', 'is_active'],
  })
  @IsOptional()
  @IsString({ message: 'Trường sắp xếp phải là chuỗi' })
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    example: 'desc',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString({ message: 'Thứ tự sắp xếp phải là chuỗi' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Có bao gồm các item đã xóa hay không (admin mặc định true)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Include deleted phải là boolean' })
  @Transform(transformBoolean)
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm trong tên và mô tả',
    example: 'thuốc',
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  @Transform(transformBoolean)
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái được chọn mặc định',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái default_checked phải là boolean' })
  @Transform(transformBoolean)
  default_checked?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái đã bị xóa (chỉ dành cho admin)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái isDeleted phải là boolean' })
  @Transform(transformBoolean)
  isDeleted?: boolean;
}
