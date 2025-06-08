import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
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
  @Roles('host')
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(
    @Body() createDto: CreateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.create(createDto, req.user!);
  }

  @Get()
  @Public()
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll(
    @Query() query: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.findAllWithUserContext(query, req.user);
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.searchWithUserContext(query, req.user);
  }

  @Get(':id')
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.findOneWithUserContext(id, req.user);
  }

  @Put(':id')
  @Roles('host')
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateHouseRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.houseRulesService.update(id, updateDto, req.user!);
  }

  @Delete(':id')
  @Roles('host')
  @ResponseMessage('Xóa quy tắc nhà thành công')
  softDelete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.softDelete(id, req.user!);
  }

  @Put('restore/:id')
  @Roles('host')
  @ResponseMessage('Khôi phục quy tắc nhà thành công')
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.houseRulesService.restore(id, req.user!);
  }
}
