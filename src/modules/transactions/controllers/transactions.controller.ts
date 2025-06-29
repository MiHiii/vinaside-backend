import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { Roles } from '../../../decorators/roles.decorator';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from '../dto/update-transaction-status.dto';
import { QueryTransactionDto } from '../dto/query-transaction.dto';
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @RequirePermission('booking.manage_payment')
  @ApiOperation({
    summary: 'Tạo giao dịch mới',
    description: 'Tạo giao dịch mới trong hệ thống',
  })
  @ApiResponse({
    status: 201,
    description: 'Giao dịch được tạo thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đầu vào không hợp lệ',
  })
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
    @Request() req: RequestWithUser,
  ) {
    // Auto-fill created_by from authenticated user
    if (!createTransactionDto.created_by) {
      createTransactionDto.created_by = req.user._id;
    }

    return this.transactionsService.createTransaction(createTransactionDto);
  }

  @Get()
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy danh sách giao dịch',
    description: 'Lấy danh sách giao dịch với lọc và phân trang',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách giao dịch thành công',
  })
  async getTransactions(@Query() query: QueryTransactionDto) {
    return this.transactionsService.getTransactions(query);
  }

  @Get('my')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Lấy giao dịch của tôi',
    description: 'Lấy danh sách giao dịch của người dùng hiện tại',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy giao dịch của người dùng thành công',
  })
  async getMyTransactions(
    @Query() query: QueryTransactionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.transactionsService.getUserTransactions(req.user._id, query);
  }

  @Get('stats')
  @RequirePermission('analytics.view')
  @ApiOperation({
    summary: 'Lấy thống kê giao dịch',
    description: 'Lấy thống kê tổng hợp về giao dịch',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thống kê giao dịch thành công',
  })
  async getTransactionStats(@Query() filters: QueryTransactionDto) {
    return this.transactionsService.getTransactionStats(filters);
  }

  @Get(':id')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy giao dịch theo ID',
    description: 'Lấy thông tin chi tiết giao dịch theo ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy giao dịch thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy giao dịch',
  })
  async getTransactionById(@Param('id') id: string) {
    return this.transactionsService.getTransactionById(id);
  }

  @Patch(':id/status')
  @RequirePermission('booking.manage_payment')
  @ApiOperation({
    summary: 'Cập nhật trạng thái giao dịch',
    description: 'Cập nhật trạng thái giao dịch và ghi log thay đổi',
  })
  @ApiParam({
    name: 'id',
    description: 'ID giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái giao dịch thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Chuyển đổi trạng thái không hợp lệ',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy giao dịch',
  })
  async updateTransactionStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTransactionStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.transactionsService.updateTransactionStatus(
      id,
      updateStatusDto,
      req.user._id,
    );
  }

  @Get(':id/logs')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy lịch sử giao dịch',
    description: 'Lấy lịch sử thay đổi trạng thái của giao dịch',
  })
  @ApiParam({
    name: 'id',
    description: 'ID giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy lịch sử giao dịch thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy giao dịch',
  })
  async getTransactionLogs(@Param('id') id: string) {
    return this.transactionsService.getTransactionLogs(id);
  }

  @Get('reference/:type/:id')
  @RequirePermission('booking.view')
  @ApiOperation({
    summary: 'Lấy giao dịch theo tham chiếu',
    description:
      'Lấy tất cả giao dịch liên quan đến đối tượng tham chiếu cụ thể',
  })
  @ApiParam({
    name: 'type',
    description: 'Loại tham chiếu (booking, payout, v.v.)',
    example: 'booking',
  })
  @ApiParam({
    name: 'id',
    description: 'ID tham chiếu',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy giao dịch tham chiếu thành công',
  })
  async getTransactionsByReference(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.getTransactionsByReference(type, id);
  }

  @Delete(':id')
  @RequirePermission('booking.manage_payment')
  @ApiOperation({
    summary: 'Xóa giao dịch',
    description: 'Xóa mềm giao dịch (chỉ admin)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID giao dịch',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa giao dịch thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy giao dịch',
  })
  async deleteTransaction(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    await this.transactionsService.deleteTransaction(id, req.user._id);
    return { message: 'Xóa giao dịch thành công' };
  }
}
