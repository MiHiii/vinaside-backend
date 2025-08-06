import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto, RevenueChartDto } from './dto/query-dashboard.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('dashboard.view')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'last_7_days', 'last_15_days', 'last_30_days', 'custom'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getDashboardStatistics(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.dashboardService.getDashboardStatistics(queryDto, req.user);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get quick dashboard overview' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'last_7_days', 'last_15_days', 'last_30_days', 'custom'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getDashboardOverview(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.dashboardService.getDashboardOverview(queryDto, req.user);
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get real-time dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Real-time dashboard data retrieved successfully',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'last_7_days', 'last_15_days', 'last_30_days', 'custom'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getRealTimeData(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.dashboardService.getRealTimeStatistics(queryDto, req.user);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Get revenue chart data with date range selection' })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data retrieved successfully',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: ['today', 'last_7_days', 'last_15_days', 'last_30_days', 'custom'],
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getRevenueChart(
    @Query() queryDto: RevenueChartDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.dashboardService.getRevenueChartData(queryDto, req.user);
  }
}
