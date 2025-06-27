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
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../../decorators/response-message.decorator';
import { Public } from '../../../decorators/public.decorator';
import { UserWithPermissions } from '../../../interfaces/user-with-permissions.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: UserWithPermissions;
}

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @RequirePermission('property.create')
  @ApiOperation({ summary: 'Tạo tài sản mới' })
  @ApiResponse({ status: 201, description: 'Tài sản được tạo thành công' })
  @ResponseMessage('Property created successfully')
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.create(createPropertyDto, req.user);
  }

  @Get()
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy tất cả tài sản' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản' })
  @ResponseMessage('Properties fetched successfully')
  findAll(@Query() queryDto: QueryPropertyDto) {
    return this.propertyService.findAll(queryDto);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lấy tài sản công khai (đã kích hoạt và xác minh)' })
  @ApiResponse({ status: 200, description: 'Danh sách tài sản công khai' })
  @ResponseMessage('Public properties fetched successfully')
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
  @ResponseMessage('Nearby properties fetched successfully')
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query() queryDto: QueryPropertyDto,
  ) {
    return this.propertyService.findNearby(lat, lng, radius, queryDto);
  }

  @Get('stats')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy thống kê tài sản' })
  @ApiResponse({ status: 200, description: 'Thống kê tài sản' })
  @ResponseMessage('Property statistics fetched successfully')
  getStats() {
    return this.propertyService.getStats();
  }

  @Get('my-properties')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy tài sản của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Tài sản của người dùng' })
  @ResponseMessage('User properties fetched successfully')
  getMyProperties(
    @Query() queryDto: QueryPropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.findByStaff(req.user._id, queryDto);
  }

  @Get('staff/:staffId')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy tài sản được gán cho một nhân viên' })
  @ApiResponse({ status: 200, description: 'Tài sản của nhân viên' })
  @ResponseMessage('Staff properties fetched successfully')
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
  @ResponseMessage('Property fetched successfully')
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Cập nhật tài sản' })
  @ApiResponse({ status: 200, description: 'Tài sản được cập nhật thành công' })
  @ResponseMessage('Property updated successfully')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.update(id, updatePropertyDto, req.user);
  }

  @Patch(':id/status')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Cập nhật trạng thái tài sản' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái tài sản được cập nhật thành công',
  })
  @ResponseMessage('Property status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.updateStatus(id, status, req.user);
  }

  @Patch(':id/verify')
  @RequirePermission('property.verify')
  @ApiOperation({ summary: 'Xác minh/hủy xác minh tài sản' })
  @ApiResponse({
    status: 200,
    description: 'Xác minh tài sản được cập nhật thành công',
  })
  @ResponseMessage('Property verification updated successfully')
  verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
    return this.propertyService.verify(id, isVerified);
  }

  @Patch(':id/staff')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Gán nhân viên cho tài sản' })
  @ApiResponse({ status: 200, description: 'Nhân viên được gán thành công' })
  @ResponseMessage('Staff assigned successfully')
  assignStaff(
    @Param('id') id: string,
    @Body('staffIds') staffIds: string[],
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.assignStaff(id, staffIds, req.user);
  }

  @Delete(':id')
  @RequirePermission('property.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa tài sản (xóa mềm)' })
  @ApiResponse({ status: 204, description: 'Tài sản được xóa thành công' })
  @ResponseMessage('Property deleted successfully')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.propertyService.remove(id, req.user);
  }

  @Patch(':id/restore')
  @RequirePermission('property.delete')
  @ApiOperation({ summary: 'Khôi phục tài sản đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Tài sản được khôi phục thành công',
  })
  @ResponseMessage('Property restored successfully')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.propertyService.restore(id, req.user);
  }
}
