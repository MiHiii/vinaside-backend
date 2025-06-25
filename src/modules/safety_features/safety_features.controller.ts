import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Query,
  Put,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SafetyFeaturesService } from './safety_features.service';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
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

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@ApiTags('Safety Features')
@Controller('safety-features')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class SafetyFeaturesController {
  constructor(private readonly safetyFeaturesService: SafetyFeaturesService) {}

  @Post()
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Tạo tính năng an toàn mới' })
  @ApiResponse({
    status: 201,
    description: 'Tính năng an toàn được tạo thành công',
  })
  @ResponseMessage('Tạo tính năng an toàn thành công')
  create(
    @Body() createSafetyFeatureDto: CreateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.create(createSafetyFeatureDto, req.user!);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách tất cả tính năng an toàn' })
  @ApiResponse({ status: 200, description: 'Danh sách tính năng an toàn' })
  @ResponseMessage('Lấy danh sách tiện ích an toàn thành công')
  findAll(
    @Query() query: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.safetyFeaturesService.findAll(query, req.user);
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Tìm kiếm tính năng an toàn theo từ khóa' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả tìm kiếm tính năng an toàn',
  })
  @ResponseMessage('Tìm kiếm tiện ích an toàn thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.search(query, req.user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tính năng an toàn' })
  @ApiResponse({ status: 200, description: 'Thông tin tính năng an toàn' })
  @ResponseMessage('Lấy tiện ích an toàn thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin tính năng an toàn' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật tính năng an toàn thành công')
  update(
    @Param('id') id: string,
    @Body() updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.update(
      id,
      updateSafetyFeatureDto,
      req.user!,
    );
  }

  @Delete(':id')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Xóa tính năng an toàn (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được xóa thành công',
  })
  @ResponseMessage('Xóa tiện ích an toàn thành công')
  softDelete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.softDelete(id, req.user!);
  }

  @Put('restore/:id')
  @RequirePermission('safety_feature.manage')
  @ApiOperation({ summary: 'Khôi phục tính năng an toàn đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Tính năng an toàn được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục tiện ích an toàn thành công')
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.restore(id, req.user!);
  }

  @Patch(':id/toggle-status')
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
    return this.safetyFeaturesService.toggleStatus(id, req.user!);
  }
}
