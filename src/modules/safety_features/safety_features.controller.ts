import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
  Put,
} from '@nestjs/common';
import { SafetyFeaturesService } from './safety_features.service';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { QuerySafetyFeatureDto } from './dto/query-safety_feature.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { Public } from '../../decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

interface SearchFilters {
  is_active?: boolean;
  default_checked?: boolean;
  includeDeleted?: boolean;
  isDeleted?: boolean;
}

@ApiTags('Safety Features')
@Controller('safety-features')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SafetyFeaturesController {
  constructor(private readonly safetyFeaturesService: SafetyFeaturesService) {}

  // =================== PUBLIC ENDPOINTS (MUST BE FIRST) ===================

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách tính năng an toàn (Public)' })
  @ResponseMessage('Lấy danh sách thành công')
  findAllPublic(@Query() queryDto: QuerySafetyFeatureDto) {
    return this.safetyFeaturesService.findAllPublic(queryDto);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Lấy chi tiết tính năng an toàn (Public)' })
  @ResponseMessage('Lấy chi tiết thành công')
  findOnePublic(@Param('id') id: string) {
    return this.safetyFeaturesService.findOnePublic(id);
  }

  // =================== PROTECTED ENDPOINTS ===================

  @Get()
  @RequirePermission('safety_feature.view')
  @ApiOperation({ summary: 'Lấy danh sách tính năng an toàn' })
  @ResponseMessage('Lấy danh sách tính năng an toàn thành công')
  findAll(@Query() queryDto: QuerySafetyFeatureDto) {
    return this.safetyFeaturesService.findAll(queryDto);
  }

  @Get('search')
  @RequirePermission('safety_feature.view')
  @ApiOperation({ summary: 'Tìm kiếm tính năng an toàn' })
  @ResponseMessage('Tìm kiếm tính năng an toàn thành công')
  search(
    @Query('query') query: string,
    @Query() filters: SearchFilters,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.searchAdmin(query, req.user, filters);
  }

  @Get(':id')
  @RequirePermission('safety_feature.view')
  @ApiOperation({ summary: 'Lấy chi tiết tính năng an toàn' })
  @ResponseMessage('Lấy tính năng an toàn thành công')
  findOne(@Param('id') id: string) {
    return this.safetyFeaturesService.findOnePublic(id);
  }

  @Post()
  @RequirePermission('safety_feature.create')
  @ApiOperation({ summary: 'Tạo tính năng an toàn mới' })
  @ResponseMessage('Tạo tính năng an toàn thành công')
  create(
    @Body() createDto: CreateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.create(createDto, req.user);
  }

  @Put(':id')
  @RequirePermission('safety_feature.edit')
  @ApiOperation({ summary: 'Cập nhật tính năng an toàn' })
  @ResponseMessage('Cập nhật tính năng an toàn thành công')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('safety_feature.delete')
  @ApiOperation({ summary: 'Xóa tính năng an toàn' })
  @ResponseMessage('Xóa tính năng an toàn thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('safety_feature.edit')
  @ApiOperation({ summary: 'Khôi phục tính năng an toàn' })
  @ResponseMessage('Khôi phục tính năng an toàn thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('safety_feature.edit')
  @ApiOperation({ summary: 'Toggle trạng thái active/inactive' })
  @ResponseMessage('Toggle trạng thái thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.toggleStatus(id, req.user);
  }

  @Put(':id/toggle-default')
  @RequirePermission('safety_feature.edit')
  @ApiOperation({ summary: 'Toggle trạng thái default_checked' })
  @ResponseMessage('Toggle default_checked thành công')
  toggleDefaultChecked(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.toggleDefaultChecked(id, req.user);
  }
}
