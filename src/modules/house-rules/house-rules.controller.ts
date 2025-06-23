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
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Request } from 'express';
import { Roles } from 'src/decorators/roles.decorator';
import { Public } from 'src/decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

@Controller('house-rules')
@UseGuards(JwtAuthGuard)
export class HouseRulesController {
  constructor(private readonly houseRulesService: HouseRulesService) {}

  @Post()
  @Roles('staff')
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(
    @Body() createHouseRuleDto: CreateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.create(createHouseRuleDto, req.user!);
  }

  @Get()
  @Public()
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll() {
    return this.houseRulesService.findAll();
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(@Query('query') query: string) {
    return this.houseRulesService.search(query);
  }

  @Get(':id')
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(@Param('id') id: string) {
    return this.houseRulesService.findOne(id);
  }

  @Patch(':id')
  @Roles('staff')
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(
    @Param('id') id: string,
    @Body() updateHouseRuleDto: UpdateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.update(id, updateHouseRuleDto, req.user!);
  }

  @Delete(':id')
  @Roles('staff')
  @ResponseMessage('Xóa quy tắc nhà thành công')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.softDelete(id, req.user!);
  }

  @Patch(':id/toggle-status')
  @Roles('staff')
  @ResponseMessage('Cập nhật trạng thái quy tắc nhà thành công')
  toggleStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.toggleStatus(id, req.user!);
  }
}
