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

  // =================== PUBLIC ENDPOINTS (MUST BE FIRST) ===================

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách quy tắc nhà (Public)' })
  @ResponseMessage('Lấy danh sách thành công')
  findAllPublic(@Query() queryDto: QueryHouseRuleDto) {
    return this.houseRulesService.findAllPublic(queryDto);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Lấy chi tiết quy tắc nhà (Public)' })
  @ResponseMessage('Lấy chi tiết thành công')
  findOnePublic(@Param('id') id: string) {
    return this.houseRulesService.findOnePublic(id);
  }

  // =================== PROTECTED ENDPOINTS ===================

  @Get()
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Lấy danh sách quy tắc nhà' })
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll(
    @Query() queryDto: QueryHouseRuleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.findAllAdmin(queryDto, req.user);
  }

  @Get('search')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Tìm kiếm quy tắc nhà' })
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(
    @Query('query') query: string,
    @Query() filters: any,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.searchAdmin(query, req.user, filters);
  }

  @Get(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Lấy chi tiết quy tắc nhà' })
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted: boolean = true,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.findOneAdmin(id, req.user, includeDeleted);
  }

  @Post()
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Tạo quy tắc nhà mới' })
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(
    @Body() createDto: CreateHouseRuleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.create(createDto, req.user);
  }

  @Put(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Cập nhật quy tắc nhà' })
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateHouseRuleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Xóa quy tắc nhà' })
  @ResponseMessage('Xóa quy tắc nhà thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Khôi phục quy tắc nhà' })
  @ResponseMessage('Khôi phục quy tắc nhà thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Toggle trạng thái active/inactive' })
  @ResponseMessage('Toggle trạng thái thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.houseRulesService.toggleStatus(id, req.user);
  }

  @Put(':id/toggle-default')
  @RequirePermission('house_rule.manage')
  @ApiOperation({ summary: 'Toggle trạng thái default_checked' })
  @ResponseMessage('Toggle default_checked thành công')
  toggleDefaultChecked(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.houseRulesService.toggleDefaultChecked(id, req.user);
  }
}
