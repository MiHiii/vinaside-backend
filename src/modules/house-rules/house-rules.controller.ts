import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Put,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { HouseRulesService } from './house-rules.service';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseRuleDto } from './dto/update-house-rule.dto';
import { QueryHouseRuleDto } from './dto/query-house-rule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { Public } from '../../decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('House Rules')
@Controller('house-rules')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class HouseRulesController {
  constructor(private readonly houseRulesService: HouseRulesService) {}

  // =================== PROTECTED ENDPOINTS ===================

  @Post()
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Tạo quy tắc nhà mới' })
  @ApiResponse({ status: 201, description: 'Quy tắc nhà được tạo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(
    @Body() createHouseRuleDto: CreateHouseRuleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.create(createHouseRuleDto, req.user);
  }

  @Put(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin quy tắc nhà' })
  @ApiResponse({
    status: 200,
    description: 'Quy tắc nhà được cập nhật thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy quy tắc nhà' })
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(
    @Param('id') id: string,
    @Body() updateHouseRuleDto: UpdateHouseRuleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.update(id, updateHouseRuleDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Xóa quy tắc nhà (soft delete)' })
  @ApiResponse({ status: 200, description: 'Quy tắc nhà được xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy quy tắc nhà' })
  @ResponseMessage('Xóa quy tắc nhà thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Khôi phục quy tắc nhà đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Quy tắc nhà được khôi phục thành công',
  })
  @ResponseMessage('Khôi phục quy tắc nhà thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('house_rule.manage')
  @ApiOperation({
    summary: 'Thay đổi trạng thái quy tắc nhà (active/inactive)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái quy tắc nhà được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái quy tắc nhà thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.toggleStatus(id, req.user);
  }

  // =================== PUBLIC ENDPOINTS ===================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả quy tắc nhà' })
  @ApiResponse({ status: 200, description: 'Danh sách quy tắc nhà' })
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll(@Query() queryDto: QueryHouseRuleDto) {
    return this.houseRulesService.findAll(queryDto);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm quy tắc nhà theo từ khóa' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm quy tắc nhà' })
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(@Query('query') query: string) {
    return this.houseRulesService.search(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết quy tắc nhà' })
  @ApiResponse({ status: 200, description: 'Thông tin quy tắc nhà' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy quy tắc nhà' })
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(@Param('id') id: string) {
    return this.houseRulesService.findOne(id);
  }
}
