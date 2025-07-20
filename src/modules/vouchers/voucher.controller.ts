import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Request,
  BadRequestException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { QueryVoucherDto } from './dto/query-voucher.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

interface RequestWithOptionalUser extends Request {
  user?: JwtPayload;
}

interface IVoucherService {
  getValidVouchersForUser(userId?: string, amount?: number): Promise<any[]>;
}

@ApiTags('Vouchers')
@Controller('vouchers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post()
  @RequirePermission('voucher.create')
  @ApiOperation({ summary: 'Tạo voucher mới' })
  @ApiResponse({ status: 201, description: 'Voucher được tạo thành công' })
  @ResponseMessage('Tạo voucher thành công')
  create(
    @Body() createVoucherDto: CreateVoucherDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.voucherService.create(createVoucherDto, req.user);
  }

  @Get()
  @RequirePermission('voucher.view')
  @ApiOperation({ summary: 'Lấy danh sách tất cả vouchers (Admin/Staff)' })
  @ApiResponse({ status: 200, description: 'Danh sách vouchers' })
  @ResponseMessage('Lấy danh sách vouchers thành công')
  findAll(@Query() queryDto: QueryVoucherDto) {
    return this.voucherService.findAll(queryDto);
  }

  @Get('valid')
  @ApiOperation({ summary: 'Lấy danh sách vouchers hợp lệ cho khách hàng' })
  @ApiResponse({ status: 200, description: 'Danh sách vouchers hợp lệ' })
  @ResponseMessage('Lấy danh sách vouchers hợp lệ thành công')
  getValidVouchers(
    @Request() req: RequestWithUser,
    @Query('total_amount') totalAmount?: string,
  ) {
    const userId = req.user._id;
    const amount = totalAmount ? parseFloat(totalAmount) : undefined;
    return (this.voucherService as IVoucherService).getValidVouchersForUser(
      userId,
      amount,
    );
  }

  @Get('validate/:code')
  @Roles('guest', 'admin', 'staff')
  @ApiOperation({
    summary: 'Kiểm tra tính hợp lệ của voucher',
    description:
      'Kiểm tra voucher có hợp lệ không, bao gồm điều kiện giá trị đơn hàng tối thiểu và giới hạn sử dụng per user',
  })
  @ApiResponse({ status: 200, description: 'Thông tin voucher hợp lệ' })
  @ResponseMessage('Kiểm tra voucher thành công')
  validateVoucher(
    @Param('code') code: string,
    @Query('total_amount') totalAmount: string,
    @Query('listing_id') listingId?: string,
    @Query('property_id') propertyId?: string,
    @Request() req?: RequestWithOptionalUser,
  ) {
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Tổng tiền phải là số dương hợp lệ');
    }

    // Lấy userId từ request nếu user đã đăng nhập
    const userId = req?.user?._id;

    return this.voucherService.validateVoucher(
      code,
      amount,
      listingId,
      propertyId,
      userId,
    );
  }

  @Get('statistics')
  @RequirePermission('voucher.view')
  @ApiOperation({ summary: 'Lấy thống kê voucher' })
  @ApiResponse({ status: 200, description: 'Thống kê voucher' })
  @ResponseMessage('Lấy thống kê voucher thành công')
  getStatistics() {
    return this.voucherService.getStatistics();
  }

  @Get('code/:code')
  @RequirePermission('voucher.view')
  @ApiOperation({ summary: 'Lấy voucher theo mã' })
  @ApiResponse({ status: 200, description: 'Thông tin voucher' })
  @ResponseMessage('Lấy voucher theo mã thành công')
  findByCode(@Param('code') code: string) {
    return this.voucherService.findByCode(code);
  }

  @Get('by-min-order-range')
  @RequirePermission('voucher.view')
  @ApiOperation({
    summary: 'Lấy danh sách voucher theo khoảng giá trị đơn hàng tối thiểu',
    description: 'Tìm voucher có min_order_value trong khoảng chỉ định',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách voucher theo khoảng giá trị',
  })
  @ResponseMessage('Lấy danh sách voucher theo khoảng giá trị thành công')
  getVouchersByMinOrderRange(
    @Query('min_value') minValue: string,
    @Query('max_value') maxValue: string,
  ) {
    if (!minValue || !maxValue) {
      throw new BadRequestException('Cần cung cấp cả min_value và max_value');
    }

    const min = parseFloat(minValue);
    const max = parseFloat(maxValue);

    if (isNaN(min) || isNaN(max)) {
      throw new BadRequestException('min_value và max_value phải là số hợp lệ');
    }

    if (min < 0 || max < 0) {
      throw new BadRequestException('Giá trị không được âm');
    }

    if (min > max) {
      throw new BadRequestException('min_value không được lớn hơn max_value');
    }

    return this.voucherService.getVouchersByMinOrderRange(min, max);
  }

  @Get(':propertyId/property')
  @Public()
  @ApiOperation({ summary: 'Lấy voucher theo property ID' })
  @ApiResponse({
    status: 200,
    description: 'Voucher cho property được tìm thấy',
  })
  @ResponseMessage('Lấy voucher theo property thành công')
  getVoucherByProperty(@Param('propertyId') propertyId: string) {
    return this.voucherService.getVoucherByProperty(propertyId);
  }

  @Get(':id')
  @RequirePermission('voucher.view')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết voucher' })
  @ApiResponse({ status: 200, description: 'Thông tin voucher' })
  @ResponseMessage('Lấy thông tin voucher thành công')
  findOne(@Param('id') id: string) {
    return this.voucherService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('voucher.edit')
  @ApiOperation({ summary: 'Cập nhật thông tin voucher' })
  @ApiResponse({ status: 200, description: 'Voucher được cập nhật thành công' })
  @ResponseMessage('Cập nhật voucher thành công')
  update(
    @Param('id') id: string,
    @Body() updateVoucherDto: UpdateVoucherDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.voucherService.update(id, updateVoucherDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('voucher.delete')
  @ApiOperation({ summary: 'Xóa voucher' })
  @ApiResponse({ status: 200, description: 'Voucher được xóa thành công' })
  @ResponseMessage('Xóa voucher thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.voucherService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('voucher.edit')
  @ApiOperation({ summary: 'Khôi phục voucher đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Voucher được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục voucher thành công')
  restore(@Param('id') id: string) {
    return this.voucherService.restore(id);
  }

  @Put(':id/toggle-status')
  @RequirePermission('voucher.edit')
  @ApiOperation({ summary: 'Thay đổi trạng thái voucher (active/inactive)' })
  @ApiResponse({ status: 200, description: 'Trạng thái voucher được thay đổi' })
  @ResponseMessage('Thay đổi trạng thái voucher thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }

    // Lấy voucher hiện tại để toggle trạng thái
    return this.voucherService.findOne(id).then((voucher) => {
      return this.voucherService.update(
        id,
        { is_active: !voucher.is_active },
        req.user,
      );
    });
  }

  @Post(':id/use')
  @RequirePermission('voucher.edit')
  @ApiOperation({ summary: 'Sử dụng voucher (đánh dấu đã dùng)' })
  @ApiResponse({ status: 201, description: 'Voucher được sử dụng thành công' })
  @ResponseMessage('Sử dụng voucher thành công')
  useVoucher(@Param('id') id: string) {
    return this.voucherService.useVoucher(id);
  }

  @Get(':id/rooms')
  @RequirePermission('voucher.view')
  @ApiOperation({ summary: 'Lấy danh sách phòng áp dụng voucher' })
  @ApiResponse({ status: 200, description: 'Danh sách phòng áp dụng voucher' })
  @ResponseMessage('Lấy danh sách phòng áp dụng voucher thành công')
  getVoucherRooms(@Param('id') id: string) {
    return this.voucherService.getVoucherWithRooms(id);
  }

  @Get(':id/min-order-info')
  @RequirePermission('voucher.view')
  @ApiOperation({
    summary: 'Lấy thông tin giá trị đơn hàng tối thiểu của voucher',
    description:
      'Trả về thông tin chi tiết về điều kiện giá trị đơn hàng tối thiểu',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin min_order_value của voucher',
  })
  @ResponseMessage('Lấy thông tin min_order_value thành công')
  getVoucherMinOrderInfo(@Param('id') id: string) {
    return this.voucherService.getVoucherMinOrderInfo(id);
  }

  @Get(':id/usage-history/:userId')
  @RequirePermission('voucher.view')
  @ApiOperation({
    summary: 'Lấy lịch sử sử dụng voucher của user',
    description: 'Trả về lịch sử sử dụng voucher của một user cụ thể',
  })
  @ApiResponse({
    status: 200,
    description: 'Lịch sử sử dụng voucher của user',
  })
  @ResponseMessage('Lấy lịch sử sử dụng voucher thành công')
  getUserVoucherHistory(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.voucherService.getUserVoucherHistory(id, userId);
  }

  @Get(':id/usage-stats')
  @RequirePermission('voucher.view')
  @ApiOperation({
    summary: 'Lấy thống kê sử dụng voucher',
    description: 'Trả về thống kê tổng quan về việc sử dụng voucher',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê sử dụng voucher',
  })
  @ResponseMessage('Lấy thống kê sử dụng voucher thành công')
  getVoucherUsageStats(@Param('id') id: string) {
    return this.voucherService.getVoucherUsageStats(id);
  }

  @Get(':id/check-booking/:bookingId')
  @RequirePermission('voucher.view')
  @ApiOperation({
    summary: 'Kiểm tra voucher có được sử dụng cho booking cụ thể không',
    description: 'Kiểm tra xem voucher đã được sử dụng cho booking này chưa',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra voucher cho booking',
  })
  @ResponseMessage('Kiểm tra voucher cho booking thành công')
  checkVoucherForBooking(
    @Param('id') id: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.voucherService.isVoucherUsedForBooking(id, bookingId);
  }
}
