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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import {
  PriceRangeQueryDto,
  BulkUpdateStatusDto,
} from './dto/common-query.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Services')
@Controller('services')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @RequirePermission('service.create')
  @ApiOperation({ summary: 'Tạo dịch vụ mới' })
  @ApiResponse({ status: 201, description: 'Dịch vụ được tạo thành công' })
  @ResponseMessage('Tạo dịch vụ thành công')
  create(
    @Body() createServiceDto: CreateServiceDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.servicesService.create(createServiceDto, req.user);
  }

  @Get()
  @RequirePermission('service.view')
  @ApiOperation({ summary: 'Lấy danh sách tất cả dịch vụ (Admin/Staff)' })
  @ApiResponse({ status: 200, description: 'Danh sách dịch vụ' })
  @ResponseMessage('Lấy danh sách dịch vụ thành công')
  findAll(@Query() queryDto: QueryServiceDto) {
    return this.servicesService.findAll(queryDto);
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách dịch vụ đang hoạt động' })
  @ApiResponse({ status: 200, description: 'Danh sách dịch vụ đang hoạt động' })
  @ResponseMessage('Lấy danh sách dịch vụ đang hoạt động thành công')
  getActiveServices() {
    return this.servicesService.getActiveServices();
  }

  @Get('price-range')
  @Public()
  @ApiOperation({ summary: 'Lấy dịch vụ theo khoảng giá' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách dịch vụ theo khoảng giá',
  })
  @ResponseMessage('Lấy dịch vụ theo khoảng giá thành công')
  getServicesByPriceRange(@Query() query: PriceRangeQueryDto) {
    return this.servicesService.getServicesByPriceRange(
      query.min_price,
      query.max_price,
    );
  }

  @Get('stats/unit')
  @RequirePermission('service.view')
  @ApiOperation({ summary: 'Lấy thống kê dịch vụ theo đơn vị' })
  @ApiResponse({ status: 200, description: 'Thống kê dịch vụ theo đơn vị' })
  @ResponseMessage('Lấy thống kê dịch vụ theo đơn vị thành công')
  getStatsByUnit() {
    return this.servicesService.getStatsByUnit();
  }

  @Get('stats/status')
  @RequirePermission('service.view')
  @ApiOperation({ summary: 'Lấy thống kê số lượng theo trạng thái' })
  @ApiResponse({
    status: 200,
    description: 'Thống kê số lượng theo trạng thái',
  })
  @ResponseMessage('Lấy thống kê trạng thái thành công')
  getStatusStats() {
    return this.servicesService.getStatusStats();
  }

  @Get('unit/:unit')
  @Public()
  @ApiOperation({ summary: 'Lấy dịch vụ theo đơn vị' })
  @ApiResponse({ status: 200, description: 'Danh sách dịch vụ theo đơn vị' })
  @ResponseMessage('Lấy dịch vụ theo đơn vị thành công')
  findByUnit(@Param('unit') unit: string) {
    return this.servicesService.findByUnit(unit);
  }

  @Get('price-order/:order')
  @Public()
  @ApiOperation({ summary: 'Lấy dịch vụ theo thứ tự giá (asc/desc)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách dịch vụ theo thứ tự giá',
  })
  @ResponseMessage('Lấy dịch vụ theo thứ tự giá thành công')
  getServicesByPriceOrder(@Param('order') order: 'asc' | 'desc') {
    return this.servicesService.getServicesByPriceOrder(order);
  }

  @Get('similar-price/:price')
  @Public()
  @ApiOperation({ summary: 'Tìm dịch vụ có giá tương tự' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách dịch vụ có giá tương tự',
  })
  @ResponseMessage('Tìm dịch vụ có giá tương tự thành công')
  findSimilarPriceServices(
    @Param('price') price: string,
    @Query('limit') limit?: string,
  ) {
    const targetPrice = parseFloat(price);
    const limitNum = limit ? parseInt(limit) : 5;

    return this.servicesService.findSimilarPriceServices(targetPrice, limitNum);
  }

  @Get('name/:name')
  @RequirePermission('service.view')
  @ApiOperation({ summary: 'Lấy dịch vụ theo tên' })
  @ApiResponse({ status: 200, description: 'Thông tin dịch vụ' })
  @ResponseMessage('Lấy dịch vụ theo tên thành công')
  findByName(@Param('name') name: string) {
    return this.servicesService.findByName(name);
  }

  @Get(':id')
  @RequirePermission('service.view')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết dịch vụ' })
  @ApiResponse({ status: 200, description: 'Thông tin dịch vụ' })
  @ResponseMessage('Lấy thông tin dịch vụ thành công')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Put('bulk-update-status')
  @RequirePermission('service.edit')
  @ApiOperation({ summary: 'Cập nhật trạng thái hàng loạt' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái hàng loạt thành công',
  })
  @ResponseMessage('Cập nhật trạng thái hàng loạt thành công')
  bulkUpdateStatus(
    @Body() bulkUpdateDto: BulkUpdateStatusDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.servicesService.bulkUpdateStatus(
      bulkUpdateDto.ids,
      bulkUpdateDto.is_active,
      req.user,
    );
  }

  @Put(':id')
  @RequirePermission('service.edit')
  @ApiOperation({ summary: 'Cập nhật thông tin dịch vụ' })
  @ApiResponse({ status: 200, description: 'Dịch vụ được cập nhật thành công' })
  @ResponseMessage('Cập nhật dịch vụ thành công')
  update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.servicesService.update(id, updateServiceDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('service.delete')
  @ApiOperation({ summary: 'Xóa dịch vụ' })
  @ApiResponse({ status: 200, description: 'Dịch vụ được xóa thành công' })
  @ResponseMessage('Xóa dịch vụ thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.servicesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('service.delete')
  @ApiOperation({ summary: 'Khôi phục dịch vụ đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Dịch vụ được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục dịch vụ thành công')
  restore(@Param('id') id: string) {
    return this.servicesService.restore(id);
  }

  @Put(':id/toggle-status')
  @RequirePermission('service.edit')
  @ApiOperation({ summary: 'Thay đổi trạng thái dịch vụ (active/inactive)' })
  @ApiResponse({ status: 200, description: 'Trạng thái dịch vụ được thay đổi' })
  @ResponseMessage('Thay đổi trạng thái dịch vụ thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.servicesService.toggleStatus(id, req.user);
  }

  @Get('property/:propertyId')
  @Public()
  @ApiOperation({ summary: 'Lấy dịch vụ theo property ID' })
  @ApiResponse({ status: 200, description: 'Danh sách dịch vụ theo property' })
  @ResponseMessage('Lấy dịch vụ theo property thành công')
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.servicesService.findByProperty(propertyId);
  }

  @Get('room/:roomId')
  @Public()
  @ApiOperation({ summary: 'Lấy dịch vụ theo room ID' })
  @ApiResponse({ status: 200, description: 'Danh sách dịch vụ theo room' })
  @ResponseMessage('Lấy dịch vụ theo room thành công')
  findByRoom(@Param('roomId') roomId: string) {
    return this.servicesService.findByRoom(roomId);
  }
}
