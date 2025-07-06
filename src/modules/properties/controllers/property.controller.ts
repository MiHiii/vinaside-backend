import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PropertyService } from '../services/property.service';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { QueryPropertyDto } from '../dto/query-property.dto';
import { PropertyStatisticsQueryDto } from '../dto/property-statistics.dto';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../../decorators/response-message.decorator';
import { Public } from '../../../decorators/public.decorator';
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';
import { Roles } from '../../../decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @Roles('admin')
  @RequirePermission('property.create')
  @ApiOperation({ summary: 'Tạo tài sản mới (Chỉ Admin)' })
  @ApiResponse({ status: 201, description: 'Tài sản được tạo thành công' })
  @ResponseMessage('Tạo tài sản thành công')
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.create(createPropertyDto, req.user);
  }

  @Get()
  @Roles('admin')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy tất cả tài sản (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản' })
  @ResponseMessage('Lấy danh sách tài sản thành công')
  findAll(@Query() queryDto: QueryPropertyDto) {
    return this.propertyService.findAll(queryDto);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lấy tài sản công khai (đã kích hoạt và xác minh)' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản công khai' })
  @ResponseMessage('Lấy danh sách tài sản công khai thành công')
  findPublic(@Query() queryDto: QueryPropertyDto) {
    return this.propertyService.findAll({
      ...queryDto,
      status: 'active',
      isVerified: true,
    });
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Tìm tài sản gần một vị trí' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản gần đó' })
  @ResponseMessage('Lấy danh sách tài sản gần đó thành công')
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query() queryDto: QueryPropertyDto,
  ) {
    return this.propertyService.findNearby(lat, lng, radius, queryDto);
  }

  @Get('stats')
  @Roles('admin')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy thống kê tài sản (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Thống kê tài sản' })
  @ResponseMessage('Lấy thống kê tài sản thành công')
  getStats() {
    return this.propertyService.getStats();
  }

  @Get(':id/statistics')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy thống kê chi tiết của một tài sản' })
  @ApiResponse({ status: 200, description: 'Thống kê chi tiết tài sản' })
  @ResponseMessage('Lấy thống kê chi tiết tài sản thành công')
  getPropertyStatistics(
    @Param('id') id: string,
    @Query() queryDto: PropertyStatisticsQueryDto,
  ) {
    return this.propertyService.getPropertyStatistics(
      id,
      queryDto.startDate,
      queryDto.endDate,
    );
  }

  @Get('my-properties')
  @Roles('admin')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy tài sản của người dùng hiện tại (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Tài sản của người dùng' })
  @ResponseMessage('Lấy tài sản của người dùng thành công')
  getMyProperties(
    @Query() queryDto: QueryPropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.findByStaff(req.user._id, queryDto);
  }

  @Get('staff/:staffId')
  @Roles('admin')
  @RequirePermission('property.view')
  @ApiOperation({
    summary: 'Lấy tài sản được gán cho một nhân viên (Chỉ Admin)',
  })
  @ApiResponse({ status: 200, description: 'Tài sản của nhân viên' })
  @ResponseMessage('Lấy tài sản của nhân viên thành công')
  getStaffProperties(
    @Param('staffId') staffId: string,
    @Query() queryDto: QueryPropertyDto,
  ) {
    return this.propertyService.findByStaff(staffId, queryDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy tài sản theo ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết tài sản' })
  @ResponseMessage('Lấy chi tiết tài sản thành công')
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Cập nhật tài sản (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Tài sản được cập nhật thành công' })
  @ResponseMessage('Cập nhật tài sản thành công')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertyService.update(id, updatePropertyDto);
  }

  @Patch(':id/status')
  @Roles('admin')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Cập nhật trạng thái tài sản (Chỉ Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái tài sản được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật trạng thái tài sản thành công')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.propertyService.updateStatus(id, status);
  }

  @Patch(':id/verify')
  @Roles('admin')
  @RequirePermission('property.verify')
  @ApiOperation({ summary: 'Xác minh/hủy xác minh tài sản (Chỉ Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Xác minh tài sản được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật xác minh tài sản thành công')
  verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
    return this.propertyService.verify(id, isVerified);
  }

  @Patch(':id/staff')
  @Roles('admin')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Gán nhân viên cho tài sản (Chỉ Admin)' })
  @ApiResponse({ status: 200, description: 'Nhân viên được gán thành công' })
  @ResponseMessage('Gán nhân viên thành công')
  assignStaff(@Param('id') id: string, @Body('staffIds') staffIds: string[]) {
    return this.propertyService.assignStaff(id, staffIds);
  }

  @Delete(':id')
  @Roles('admin')
  @RequirePermission('property.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa tài sản (xóa mềm) - Chỉ Admin' })
  @ApiResponse({ status: 204, description: 'Tài sản được xóa thành công' })
  @ResponseMessage('Xóa tài sản thành công')
  remove(@Param('id') id: string) {
    return this.propertyService.remove(id);
  }

  @Patch(':id/restore')
  @Roles('admin')
  @RequirePermission('property.delete')
  @ApiOperation({ summary: 'Khôi phục tài sản đã xóa (Chỉ Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Tài sản được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục tài sản thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.propertyService.restore(id, req.user);
  }
}
