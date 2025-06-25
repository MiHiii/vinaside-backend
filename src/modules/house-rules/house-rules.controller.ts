import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  Patch,
} from '@nestjs/common';

import { HouseRulesService } from './houserules.service';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Request } from 'express';
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

@ApiTags('House Rules')
@Controller('house-rules')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class HouseRulesController {
  constructor(private readonly houseRulesService: HouseRulesService) {}

  @Post()
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Tạo quy tắc nhà mới' })
  @ApiResponse({ status: 201, description: 'Quy tắc nhà được tạo thành công' })
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(
    @Body() createHouseRuleDto: CreateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.create(createHouseRuleDto, req.user!);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách tất cả quy tắc nhà' })
  @ApiResponse({ status: 200, description: 'Danh sách quy tắc nhà' })
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll() {
    return this.houseRulesService.findAll();
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Tìm kiếm quy tắc nhà theo từ khóa' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm quy tắc nhà' })
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(@Query('query') query: string) {
    return this.houseRulesService.search(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết quy tắc nhà' })
  @ApiResponse({ status: 200, description: 'Thông tin quy tắc nhà' })
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(@Param('id') id: string) {
    return this.houseRulesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin quy tắc nhà' })
  @ApiResponse({
    status: 200,
    description: 'Quy tắc nhà được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(
    @Param('id') id: string,
    @Body() updateHouseRuleDto: UpdateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.update(id, updateHouseRuleDto, req.user!);
  }

  @Delete(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Xóa quy tắc nhà (soft delete)' })
  @ApiResponse({ status: 200, description: 'Quy tắc nhà được xóa thành công' })
  @ResponseMessage('Xóa quy tắc nhà thành công')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.softDelete(id, req.user!);
  }

  @Patch(':id/toggle-status')
  @RequirePermission('house_rule.manage')
  @ApiOperation({
    summary: 'Thay đổi trạng thái quy tắc nhà (active/inactive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái quy tắc nhà được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái quy tắc nhà thành công')
  toggleStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.toggleStatus(id, req.user!);
  }
}
