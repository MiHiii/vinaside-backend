import { Type, Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsMongoId,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueryMessageDto {
  @ApiProperty({ description: 'Trang hiện tại', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Số lượng tin nhắn mỗi trang',
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
    description: 'Sắp xếp theo trường',
    required: false,
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiProperty({
    description: 'Thứ tự sắp xếp',
    required: false,
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    description: 'Bao gồm tin nhắn đã xóa',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  includeDeleted?: boolean = false;

  @ApiProperty({ description: 'ID người gửi', required: false })
  @IsOptional()
  @IsMongoId()
  sender_id?: string;

  @ApiProperty({ description: 'ID người nhận', required: false })
  @IsOptional()
  @IsMongoId()
  receiver_id?: string;

  @ApiProperty({ description: 'Nội dung tin nhắn', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Trạng thái đã đọc', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return Boolean(value);
  })
  is_read?: boolean;

  @ApiProperty({ description: 'Tìm kiếm theo nội dung', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'ID của người dùng khác trong cuộc trò chuyện',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  otherUserId?: string;
}
