import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryServiceDto {
  @ApiProperty({
    example: 1,
    description: 'Số trang',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 10,
    description: 'Số lượng item trên mỗi trang',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    example: 'name',
    description: 'Trường để sắp xếp',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiProperty({
    example: 'desc',
    description: 'Thứ tự sắp xếp',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    example: 'WiFi',
    description: 'Tìm kiếm theo tên dịch vụ',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: '/ngày',
    description: 'Lọc theo đơn vị',
    required: false,
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    example: 10000,
    description: 'Giá tối thiểu',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    example: 100000,
    description: 'Giá tối đa',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({
    example: true,
    description: 'Lọc theo trạng thái hoạt động',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  is_active?: boolean;

  @ApiProperty({
    example: false,
    description: 'Bao gồm item đã xóa',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;

  @ApiProperty({
    example: 'wifi miễn phí',
    description: 'Từ khóa tìm kiếm',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}
