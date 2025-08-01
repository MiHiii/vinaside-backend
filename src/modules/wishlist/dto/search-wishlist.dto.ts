import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  IsMongoId,
  IsEnum,
  IsBoolean,
  IsDateString,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchWishlistDto {
  @ApiProperty({ required: false, description: 'Số trang' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, description: 'Số lượng item trên mỗi trang' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Sắp xếp theo trường' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiProperty({
    required: false,
    enum: ['asc', 'desc'],
    description: 'Thứ tự sắp xếp',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    required: false,
    description:
      'Từ khóa tìm kiếm (tìm trong tên phòng, tên property, địa chỉ, tên người yêu thích)',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false, description: 'Tìm theo tên phòng' })
  @IsOptional()
  @IsString()
  roomTitle?: string;

  @ApiProperty({ required: false, description: 'Tìm theo tên property' })
  @IsOptional()
  @IsString()
  propertyName?: string;

  @ApiProperty({ required: false, description: 'Tìm theo địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    required: false,
    description: 'Tìm theo tên người yêu thích (user)',
  })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiProperty({ required: false, description: 'Tìm theo email user' })
  @IsOptional()
  @IsString()
  userEmail?: string;

  @ApiProperty({
    required: false,
    description: 'Lọc theo khoảng giá tối thiểu',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiProperty({ required: false, description: 'Lọc theo khoảng giá tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiProperty({ required: false, description: 'Lọc theo số khách tối thiểu' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minGuests?: number;

  @ApiProperty({ required: false, description: 'Lọc theo số khách tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxGuests?: number;

  @ApiProperty({ required: false, description: 'Lọc theo rating tối thiểu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  @ApiProperty({ required: false, description: 'Lọc theo rating tối đa' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  maxRating?: number;

  @ApiProperty({ required: false, description: 'ID của user' })
  @IsOptional()
  @IsMongoId()
  user_id?: string;

  @ApiProperty({ required: false, description: 'ID của property' })
  @IsOptional()
  @IsMongoId()
  property_id?: string;

  @ApiProperty({ required: false, description: 'ID của room' })
  @IsOptional()
  @IsMongoId()
  room_id?: string;

  @ApiProperty({ required: false, description: 'Từ ngày' })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiProperty({ required: false, description: 'Đến ngày' })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiProperty({ required: false, description: 'Trạng thái xóa' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDelete?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Bao gồm cả đã xóa (mặc định: false - chỉ lấy dữ liệu chưa xóa)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean = false;
}
