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
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { QueryAmenityDto } from './dto/query-amenity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { Public } from '../../decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Amenities')
@Controller('amenities')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  // =================== PUBLIC ENDPOINTS (MUST BE FIRST) ===================

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách tiện ích (Public)' })
  @ResponseMessage('Lấy danh sách thành công')
  findAllPublic(@Query() queryDto: QueryAmenityDto) {
    return this.amenitiesService.findAllPublic(queryDto);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Lấy chi tiết tiện ích (Public)' })
  @ResponseMessage('Lấy chi tiết thành công')
  findOnePublic(@Param('id') id: string) {
    return this.amenitiesService.findOnePublic(id);
  }

  // =================== PROTECTED ENDPOINTS ===================

  @Get()
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Lấy danh sách tiện ích' })
  @ResponseMessage('Lấy danh sách tiện ích thành công')
  findAll(@Query() queryDto: QueryAmenityDto, @Request() req: RequestWithUser) {
    return this.amenitiesService.findAllAdmin(queryDto, req.user);
  }

  @Get('search')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Tìm kiếm tiện ích' })
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(
    @Query('query') query: string,
    @Query() filters: any,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.searchAdmin(query, req.user, filters);
  }

  @Get(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Lấy chi tiết tiện ích' })
  @ResponseMessage('Lấy tiện ích thành công')
  findOne(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted: boolean = true,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.findOneAdmin(id, req.user, includeDeleted);
  }

  @Post()
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Tạo tiện ích mới' })
  @ResponseMessage('Tạo tiện ích thành công')
  create(@Body() createDto: CreateAmenityDto, @Request() req: RequestWithUser) {
    return this.amenitiesService.create(createDto, req.user);
  }

  @Put(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Cập nhật tiện ích' })
  @ResponseMessage('Cập nhật tiện ích thành công')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.update(id, updateDto, req.user);
  }

  @Delete(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Xóa tiện ích' })
  @ResponseMessage('Xóa tiện ích thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.remove(id, req.user);
  }

  @Put(':id/restore')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Khôi phục tiện ích' })
  @ResponseMessage('Khôi phục tiện ích thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.restore(id, req.user);
  }

  @Put(':id/toggle-status')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Toggle trạng thái active/inactive' })
  @ResponseMessage('Toggle trạng thái thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.toggleStatus(id, req.user);
  }

  @Put(':id/toggle-default')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Toggle trạng thái default_checked' })
  @ResponseMessage('Toggle default_checked thành công')
  toggleDefaultChecked(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.toggleDefaultChecked(id, req.user);
  }
}
