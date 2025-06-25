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
import { UserWithPermissions } from 'src/interfaces/user-with-permissions.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: UserWithPermissions;
}

@ApiTags('Vouchers')
@Controller('vouchers')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post()
  @RequirePermission('booking.manage_payment')
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
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy danh sách tất cả vouchers (Admin/Staff)' })
  @ApiResponse({ status: 200, description: 'Danh sách vouchers' })
  @ResponseMessage('Lấy danh sách vouchers thành công')
  findAll(@Query() queryDto: QueryVoucherDto) {
    return this.voucherService.findAll(queryDto);
  }

  @Get('valid')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách vouchers hợp lệ cho khách hàng' })
  @ApiResponse({ status: 200, description: 'Danh sách vouchers hợp lệ' })
  @ResponseMessage('Lấy danh sách vouchers hợp lệ thành công')
  getValidVouchers() {
    return this.voucherService.getValidVouchers();
  }

  @Get('validate/:code')
  @Roles('guest', 'admin', 'staff')
  @ApiOperation({ summary: 'Kiểm tra tính hợp lệ của voucher' })
  @ApiResponse({ status: 200, description: 'Thông tin voucher hợp lệ' })
  @ResponseMessage('Kiểm tra voucher thành công')
  validateVoucher(
    @Param('code') code: string,
    @Query('total_amount') totalAmount: string,
    @Query('listing_id') listingId?: string,
  ) {
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Tổng tiền phải là số dương hợp lệ');
    }
    return this.voucherService.validateVoucher(code, amount, listingId);
  }

  @Get('code/:code')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy voucher theo mã' })
  @ApiResponse({ status: 200, description: 'Thông tin voucher' })
  @ResponseMessage('Lấy voucher theo mã thành công')
  findByCode(@Param('code') code: string) {
    return this.voucherService.findByCode(code);
  }

  @Get(':id')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết voucher' })
  @ApiResponse({ status: 200, description: 'Thông tin voucher' })
  @ResponseMessage('Lấy thông tin voucher thành công')
  findOne(@Param('id') id: string) {
    return this.voucherService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('booking.manage_payment')
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
  @RequirePermission('booking.manage_payment')
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
  @RequirePermission('booking.manage_payment')
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
  @RequirePermission('booking.manage_payment')
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
  @RequirePermission('booking.manage_payment')
  @ApiOperation({ summary: 'Sử dụng voucher (đánh dấu đã dùng)' })
  @ApiResponse({ status: 201, description: 'Voucher được sử dụng thành công' })
  @ResponseMessage('Sử dụng voucher thành công')
  useVoucher(@Param('id') id: string) {
    return this.voucherService.useVoucher(id);
  }

  @Get(':id/rooms')
  @RequirePermission('booking.view')
  @ApiOperation({ summary: 'Lấy danh sách phòng áp dụng voucher' })
  @ApiResponse({ status: 200, description: 'Danh sách phòng áp dụng voucher' })
  @ResponseMessage('Lấy danh sách phòng áp dụng voucher thành công')
  getVoucherRooms(@Param('id') id: string) {
    return this.voucherService.getVoucherWithRooms(id);
  }
}
