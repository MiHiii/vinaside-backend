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
} from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { QueryVoucherDto } from './dto/query-voucher.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { UserWithPermissions } from 'src/interfaces/user-with-permissions.interface';

interface RequestWithUser extends Request {
  user: UserWithPermissions;
}

@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post()
  @Roles('admin', 'staff')
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
  @Roles('admin', 'staff')
  @ResponseMessage('Lấy danh sách vouchers thành công')
  findAll(@Query() queryDto: QueryVoucherDto) {
    return this.voucherService.findAll(queryDto);
  }

  @Get('valid')
  @Public()
  @ResponseMessage('Lấy danh sách vouchers hợp lệ thành công')
  getValidVouchers() {
    return this.voucherService.getValidVouchers();
  }

  @Get('validate/:code')
  @Roles('guest', 'admin', 'staff')
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
  @Roles('admin', 'staff')
  @ResponseMessage('Lấy voucher theo mã thành công')
  findByCode(@Param('code') code: string) {
    return this.voucherService.findByCode(code);
  }

  @Get(':id')
  @Roles('admin', 'staff')
  @ResponseMessage('Lấy thông tin voucher thành công')
  findOne(@Param('id') id: string) {
    return this.voucherService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'staff')
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
  @Roles('admin')
  @ResponseMessage('Xóa voucher thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.voucherService.remove(id, req.user);
  }

  @Put(':id/restore')
  @Roles('admin')
  @ResponseMessage('Khôi phục voucher thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.voucherService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @Roles('admin', 'staff')
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
  @Roles('admin', 'staff')
  @ResponseMessage('Sử dụng voucher thành công')
  useVoucher(@Param('id') id: string) {
    return this.voucherService.useVoucher(id);
  }

  @Get(':id/rooms')
  @Roles('admin', 'staff')
  @ResponseMessage('Lấy danh sách phòng áp dụng voucher thành công')
  getVoucherRooms(@Param('id') id: string) {
    return this.voucherService.getVoucherWithRooms(id);
  }
}
