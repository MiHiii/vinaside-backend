import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { PropertyStaffGuard } from '../../../common/guards/property-staff.guard';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { RequirePropertyStaff } from '../../../decorators/require-property-staff.decorator';
import { TransactionLogsService } from '../services/transaction-logs.service';
import { ChangedBy } from '../schemas/transaction-log.schema';

@ApiTags('Transaction Logs')
@Controller('transaction-logs')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
@ApiBearerAuth()
export class TransactionLogsController {
  constructor(
    private readonly transactionLogsService: TransactionLogsService,
  ) {}

  @Get('transaction/:id')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy log của giao dịch cụ thể',
    description: 'Lấy tất cả log thay đổi trạng thái của một giao dịch',
  })
  @ApiParam({
    name: 'id',
    description: 'ID giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    description: 'Bao gồm log đã xóa mềm',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy log giao dịch thành công',
  })
  async getTransactionLogs(
    @Param('id') transactionId: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ) {
    return this.transactionLogsService.getTransactionLogs(
      transactionId,
      includeDeleted,
    );
  }

  @Get('user/:userId')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy log theo người dùng',
    description: 'Lấy tất cả log giao dịch của một người dùng cụ thể',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID người dùng',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Ngày bắt đầu lọc (chuỗi ISO)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Ngày kết thúc lọc (chuỗi ISO)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy log giao dịch của người dùng thành công',
  })
  async getLogsByUser(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionLogsService.getLogsByUser(userId, start, end);
  }

  @Get('changed-by/:changedBy')
  @RequirePermission('analytics.view')
  @ApiOperation({
    summary: 'Lấy log theo người thực hiện',
    description: 'Lấy tất cả log được lọc theo người đã thực hiện thay đổi',
  })
  @ApiParam({
    name: 'changedBy',
    description: 'Người đã thực hiện thay đổi',
    enum: ChangedBy,
    example: ChangedBy.SYSTEM,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Ngày bắt đầu lọc (chuỗi ISO)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Ngày kết thúc lọc (chuỗi ISO)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy log giao dịch thành công',
  })
  async getLogsByChangedBy(
    @Param('changedBy') changedBy: ChangedBy,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionLogsService.getLogsByChangedBy(
      changedBy,
      start,
      end,
    );
  }

  @Get('stats')
  @RequirePermission('analytics.view')
  @ApiOperation({
    summary: 'Lấy thống kê log giao dịch',
    description: 'Lấy thống kê tổng hợp về log giao dịch',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Ngày bắt đầu lọc (chuỗi ISO)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Ngày kết thúc lọc (chuỗi ISO)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thống kê log giao dịch thành công',
  })
  async getLogsStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionLogsService.getLogsStatistics(start, end);
  }

  @Get(':id')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy log giao dịch theo ID',
    description: 'Lấy thông tin chi tiết log giao dịch theo ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID log giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy log giao dịch thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy log giao dịch',
  })
  async getLogById(@Param('id') id: string) {
    return this.transactionLogsService.getLogById(id);
  }

  @Delete(':id')
  @RequirePermission('booking.manage_payment')
  @ApiOperation({
    summary: 'Xóa log giao dịch',
    description: 'Xóa mềm log giao dịch (chỉ admin)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID log giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa log giao dịch thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy log giao dịch',
  })
  async deleteLog(@Param('id') id: string) {
    await this.transactionLogsService.deleteLog(id);
    return { message: 'Xóa log giao dịch thành công' };
  }

  @Get('property/:propertyId')
  @RequirePermission('booking.view')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({
    summary: 'Lấy log giao dịch theo property',
    description: 'Lấy tất cả log giao dịch của một property cụ thể (chỉ staff)',
  })
  @ApiParam({
    name: 'propertyId',
    description: 'ID property',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Ngày bắt đầu lọc (chuỗi ISO)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Ngày kết thúc lọc (chuỗi ISO)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy log giao dịch property thành công',
  })
  async getLogsByProperty(
    @Param('propertyId') propertyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionLogsService.getLogsByProperty(
      propertyId,
      start,
      end,
    );
  }
}
