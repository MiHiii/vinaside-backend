import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Query,
  NotFoundException,
  Put,
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

@Controller('safety-features')
export class SafetyFeaturesController {
  constructor(private readonly safetyFeaturesService: SafetyFeaturesService) {}

  @Post()
  @Roles('host')
  @ResponseMessage('Tạo tiện ích an toàn thành công')
  create(
    @Body() createSafetyFeatureDto: CreateSafetyFeatureDto,
    @Req() req: AuthenticatedRequest,
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
    return this.safetyFeaturesService.findAllWithUserContext(query, req.user);
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm tiện ích an toàn thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.searchWithUserContext(query, req.user);
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Lấy tiện ích an toàn thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.findOneWithUserContext(id, req.user);
  }

  @Put(':id')
  @Roles('host')
  @ResponseMessage('Cập nhật tiện ích an toàn thành công')
  update(
    @Param('id') id: string,
    @Body() updateSafetyFeatureDto: UpdateSafetyFeatureDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.safetyFeaturesService.update(
      id,
      updateSafetyFeatureDto,
      req.user!,
    );
  }

  @Delete(':id')
  @Roles('host')
  @ResponseMessage('Xóa tiện ích an toàn thành công')
  softDelete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.softDelete(id, req.user!);
  }

  @Put('restore/:id')
  @Roles('host')
  @ResponseMessage('Khôi phục tiện ích an toàn thành công')
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.safetyFeaturesService.restore(id, req.user!);
  }
}
