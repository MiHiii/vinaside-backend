import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
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
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getDashboardStatistics(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    // Enforce propertyId for staff users
    if (req.user.role === 'staff' && !queryDto.propertyId) {
      throw new BadRequestException('Property ID is required for staff users');
    }

    return this.dashboardService.getDashboardStatistics(
      queryDto.startDate,
      queryDto.endDate,
      queryDto.propertyId,
    );
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get quick dashboard overview' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
  })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getDashboardOverview(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    // Enforce propertyId for staff users
    if (req.user.role === 'staff' && !queryDto.propertyId) {
      throw new BadRequestException('Property ID is required for staff users');
    }

    return this.dashboardService.getDashboardOverview(queryDto.propertyId);
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get real-time dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Real-time dashboard data retrieved successfully',
  })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  async getRealTimeData(
    @Query() queryDto: QueryDashboardDto,
    @Request() req: { user: JwtPayload },
  ) {
    // Enforce propertyId for staff users
    if (req.user.role === 'staff' && !queryDto.propertyId) {
      throw new BadRequestException('Property ID is required for staff users');
    }

    return this.dashboardService.getRealTimeStatistics();
  }
}
