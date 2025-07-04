import { ApiProperty } from '@nestjs/swagger';

export class HouseRuleStatusStatDto {
  @ApiProperty({
    description: 'Số lượng house rules đang hoạt động',
    example: 15,
  })
  active: number;

  @ApiProperty({
    description: 'Số lượng house rules không hoạt động',
    example: 3,
  })
  inactive: number;
}

export class HouseRuleDefaultStatDto {
  @ApiProperty({
    description: 'Số lượng house rules được chọn mặc định',
    example: 8,
  })
  defaultChecked: number;

  @ApiProperty({
    description: 'Số lượng house rules không được chọn mặc định',
    example: 10,
  })
  notDefaultChecked: number;
}

export class HouseRuleActivityDto {
  @ApiProperty({
    description: 'Ngày tạo (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Số lượng house rules được tạo trong ngày',
    example: 2,
  })
  count: number;
}

export class HouseRuleTopCreatorDto {
  @ApiProperty({
    description: 'ID của người tạo',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'Số lượng house rules đã tạo',
    example: 5,
  })
  count: number;
}

export class HouseRuleStatisticsResponseDto {
  @ApiProperty({
    description: 'Tổng số house rules',
    example: 18,
  })
  total: number;

  @ApiProperty({
    description: 'Số lượng house rules đang hoạt động',
    example: 15,
  })
  active: number;

  @ApiProperty({
    description: 'Số lượng house rules không hoạt động',
    example: 3,
  })
  inactive: number;

  @ApiProperty({
    description: 'Số lượng house rules được chọn mặc định',
    example: 8,
  })
  defaultChecked: number;

  @ApiProperty({
    description: 'Số lượng house rules đã bị xóa',
    example: 2,
  })
  deleted: number;

  @ApiProperty({
    description: 'Số lượng house rules được tạo hôm nay',
    example: 1,
  })
  createdToday: number;

  @ApiProperty({
    description: 'Số lượng house rules được tạo tuần này',
    example: 4,
  })
  createdThisWeek: number;

  @ApiProperty({
    description: 'Số lượng house rules được tạo tháng này',
    example: 6,
  })
  createdThisMonth: number;

  @ApiProperty({
    description: 'Thống kê theo trạng thái',
    type: HouseRuleStatusStatDto,
  })
  byStatus: HouseRuleStatusStatDto;

  @ApiProperty({
    description: 'Thống kê theo trạng thái default',
    type: HouseRuleDefaultStatDto,
  })
  byDefaultStatus: HouseRuleDefaultStatDto;

  @ApiProperty({
    description: 'Hoạt động gần đây (tạo house rules theo ngày)',
    type: [HouseRuleActivityDto],
  })
  recentActivity: HouseRuleActivityDto[];

  @ApiProperty({
    description: 'Top 10 người tạo nhiều house rules nhất',
    type: [HouseRuleTopCreatorDto],
  })
  topCreators: HouseRuleTopCreatorDto[];
}
