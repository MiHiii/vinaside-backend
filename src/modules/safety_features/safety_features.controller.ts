import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SafetyFeaturesService } from './safety_features.service';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { QuerySafetyFeatureDto } from './dto/query-safety_feature.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Safety Features')
@Controller('safety-features')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SafetyFeaturesController {
  constructor(private readonly safetyFeaturesService: SafetyFeaturesService) {}

  // =================== PROTECTED ENDPOINTS ===================

  @Post()
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Tạo tính năng an toàn mới' })
  @ApiResponse({
    status: 201,
    description: 'Tính năng an toàn được tạo thành công',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ResponseMessage('Tạo tính năng an toàn thành công')
  create(
    @Body() createSafetyFeatureDto: CreateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.create(createSafetyFeatureDto, req.user);
  }

  @Put(':id')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin tính năng an toàn' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tính năng an toàn' })
  @ResponseMessage('Cập nhật tính năng an toàn thành công')
  update(
    @Param('id') id: string,
    @Body() updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.update(
      id,
      updateSafetyFeatureDto,
      req.user,
    );
  }

  @Delete(':id')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Xóa tính năng an toàn (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được xóa thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tính năng an toàn' })
  @ResponseMessage('Xóa tính năng an toàn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Khôi phục tính năng an toàn đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục tính năng an toàn thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({
    summary: 'Thay đổi trạng thái tính năng an toàn (active/inactive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái tính năng an toàn được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái tính năng an toàn thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.toggleStatus(id, req.user);
  }

  @Put(':id/toggle-default')
  @RequirePermission('safety_feature.manage')
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
    return this.safetyFeaturesService.toggleDefaultChecked(id, req.user);
  }

  // =================== PUBLIC ENDPOINTS ===================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả tính năng an toàn' })
  @ApiResponse({ status: 200, description: 'Danh sách tính năng an toàn' })
  @ResponseMessage('Lấy danh sách tính năng an toàn thành công')
  findAll(@Query() queryDto: QuerySafetyFeatureDto) {
    return this.safetyFeaturesService.findAll(queryDto);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm tính năng an toàn theo từ khóa' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả tìm kiếm tính năng an toàn',
  })
  @ResponseMessage('Tìm kiếm tính năng an toàn thành công')
  search(@Query('query') query: string) {
    return this.safetyFeaturesService.search(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tính năng an toàn' })
  @ApiResponse({ status: 200, description: 'Thông tin tính năng an toàn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tính năng an toàn' })
  @ResponseMessage('Lấy tính năng an toàn thành công')
  findOne(@Param('id') id: string) {
    return this.safetyFeaturesService.findOne(id);
  }
}
