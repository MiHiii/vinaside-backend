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
} from '@nestjs/common';
import { SafetyFeaturesService } from './safety_features.service';
import { CreateSafetyFeatureDto } from './dto/create-safety_feature.dto';
import { UpdateSafetyFeatureDto } from './dto/update-safety_feature.dto';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Controller('safety-features')
export class SafetyFeaturesController {
  constructor(private readonly safetyFeaturesService: SafetyFeaturesService) {}

  @Post()
  @Roles('staff')
  @ResponseMessage('Tạo tính năng an toàn thành công')
  create(
    @Body() createSafetyFeatureDto: CreateSafetyFeatureDto,
    @Request() req: RequestWithUser,
  ) {
    return this.safetyFeaturesService.create(createSafetyFeatureDto, req.user!);
  }

  @Get()
  @Public()
  @ResponseMessage('Lấy danh sách tiện ích an toàn thành công')
  findAll(
    @Query() query: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.safetyFeaturesService.findAll(query, req.user);
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm tiện ích an toàn thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.search(query, req.user);
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Lấy tiện ích an toàn thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('staff')
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
  @Roles('staff')
  @ResponseMessage('Xóa tiện ích an toàn thành công')
  softDelete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.softDelete(id, req.user!);
  }

  @Put('restore/:id')
  @Roles('staff')
  @ResponseMessage('Khôi phục tiện ích an toàn thành công')
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.restore(id, req.user!);
  }

  @Patch(':id/toggle-status')
  @Roles('staff')
  @ResponseMessage('Cập nhật trạng thái tính năng an toàn thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.safetyFeaturesService.toggleStatus(id, req.user!);
  }
}
