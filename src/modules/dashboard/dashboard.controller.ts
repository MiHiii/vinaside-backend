import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardStatisticsQueryDto,
  DashboardStatisticsResponseDto,
  DashboardOverviewResponseDto,
} from './dto/dashboard-statistics';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../decorators/user.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistics')
  @Roles('admin', 'staff')
  @RequirePermission('dashboard.view')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê dashboard thành công',
    type: DashboardStatisticsResponseDto,
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['auto', 'day', 'week', 'month', 'year'],
  })
  async getDashboardStatistics(
    @Query() query: DashboardStatisticsQueryDto,
    @User() user: JwtPayload,
  ) {
    const { startDate, endDate, propertyId, groupBy } = query;

    // Nếu user là staff, chỉ cho phép xem thống kê của property được assign
    if (user.role === 'staff' && !propertyId) {
      throw new Error('Staff phải chỉ định propertyId để xem thống kê');
    }

    return this.dashboardService.getDashboardStatistics(
      startDate,
      endDate,
      propertyId,
      groupBy,
    );
  }

  @Get('overview')
  @Roles('admin', 'staff')
  @RequirePermission('dashboard.view')
  @ApiOperation({ summary: 'Lấy thống kê tổng quan nhanh' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê tổng quan thành công',
    type: DashboardOverviewResponseDto,
  })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getDashboardOverview(
    @Query('propertyId') propertyId?: string,
    @User() user?: JwtPayload,
  ) {
    // Nếu user là staff, chỉ cho phép xem thống kê của property được assign
    if (user?.role === 'staff' && !propertyId) {
      throw new Error('Staff phải chỉ định propertyId để xem thống kê');
    }

    return this.dashboardService.getDashboardOverview(propertyId);
  }

  @Get('realtime')
  @Roles('admin', 'staff')
  @RequirePermission('dashboard.view')
  @ApiOperation({ summary: 'Lấy thống kê real-time' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê real-time thành công',
  })
  async getRealTimeStatistics() {
    return this.dashboardService.getRealTimeStatistics();
  }
}
