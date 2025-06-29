import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Query,
  Patch,
  Request,
  UseGuards,
  Put,
} from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { QueryAmenityDto } from './dto/query-amenity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { Public } from '../../decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Amenities')
@Controller('amenities')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Tạo tiện ích mới' })
  @ApiResponse({ status: 201, description: 'Tiện ích được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ResponseMessage('Tạo tiện ích thành công')
  create(
    @Body() createAmenityDto: CreateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.create(createAmenityDto, req.user);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách tất cả tiện ích' })
  @ApiResponse({ status: 200, description: 'Danh sách tiện ích' })
  @ResponseMessage('Lấy danh sách tiện ích thành công')
  findAll(@Query() queryDto: QueryAmenityDto) {
    return this.amenitiesService.findAll(queryDto);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Tìm kiếm tiện ích theo từ khóa' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm tiện ích' })
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(@Query('query') query: string) {
    return this.amenitiesService.search(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tiện ích' })
  @ApiResponse({ status: 200, description: 'Thông tin tiện ích' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiện ích' })
  @ResponseMessage('Lấy tiện ích thành công')
  findOne(@Param('id') id: string) {
    return this.amenitiesService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin tiện ích' })
  @ApiResponse({
    status: 200,
    description: 'Tiện ích được cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiện ích' })
  @ResponseMessage('Cập nhật tiện ích thành công')
  update(
    @Param('id') id: string,
    @Body() updateAmenityDto: UpdateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.update(id, updateAmenityDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Xóa tiện ích (soft delete)' })
  @ApiResponse({ status: 200, description: 'Tiện ích được xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiện ích' })
  @ResponseMessage('Xóa tiện ích thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Khôi phục tiện ích đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Tiện ích được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục tiện ích thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('amenity.manage')
  @ApiOperation({
    summary: 'Thay đổi trạng thái tiện ích (active/inactive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái tiện ích được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái tiện ích thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.toggleStatus(id, req.user);
  }

  @Put(':id/toggle-default')
  @RequirePermission('amenity.manage')
  @ApiOperation({
    summary: 'Thay đổi trạng thái default_checked (có được chọn mặc định)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái default_checked được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái default_checked thành công')
  toggleDefaultChecked(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.toggleDefaultChecked(id, req.user);
  }
}
