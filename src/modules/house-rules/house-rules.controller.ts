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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; // giả sử bạn có guard JWT
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Request } from 'express';

@Controller('house-rules')
@UseGuards(JwtAuthGuard)
export class HouseRulesController {
  constructor(private readonly houseRulesService: HouseRulesService) {}

  @Post()
  @ResponseMessage('Tạo quy tắc nhà thành công')
  create(@Body() createDto: CreateHouseRuleDto, @Req() req: Request) {
    const user = req.user as any; // JwtPayload
    return this.houseRulesService.create(createDto, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách quy tắc nhà thành công')
  findAll(@Query() query, @Req() req: Request) {
    const user = req.user as any; // JwtPayload
    // Filter quy tắc nhà theo user hiện tại (host)
    const userQuery = { ...query, createdBy: user._id };
    return this.houseRulesService.findAll(userQuery);
  }

  @Get('search')
  @ResponseMessage('Tìm kiếm quy tắc nhà thành công')
  search(@Query('query') query: string, @Req() req: Request) {
    const user = req.user as any; // JwtPayload
    return this.houseRulesService.search(query, user._id);
  }

  @Get(':id')
  @ResponseMessage('Lấy quy tắc nhà thành công')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any; // JwtPayload
    return this.houseRulesService.findOne(id, user._id);
  }

  @Put(':id')
  @ResponseMessage('Cập nhật quy tắc nhà thành công')
  update(@Param('id') id: string, @Body() updateDto: UpdateHouseRuleDto, @Req() req: Request) {
    const user = req.user as any;
    return this.houseRulesService.update(id, updateDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Xóa quy tắc nhà thành công')
  softDelete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.houseRulesService.softDelete(id, user);
  }

  // khôi phục quy tắc nhà
  @Put('restore/:id')
  @ResponseMessage('Khôi phục quy tắc nhà thành công')
  restore(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    return this.houseRulesService.restore(id, user);
  }
}