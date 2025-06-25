import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Query,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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

@ApiTags('Amenities')
@Controller('amenities')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Tạo tiện ích mới' })
  @ApiResponse({ status: 201, description: 'Tiện ích được tạo thành công' })
  @ResponseMessage('Tạo tiện ích thành công')
  create(
    @Body() createAmenityDto: CreateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.create(createAmenityDto, req.user!);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách tất cả tiện ích' })
  @ApiResponse({ status: 200, description: 'Danh sách tiện ích' })
  @ResponseMessage('Lấy danh sách tiện ích thành công')
  findAll() {
    return this.amenitiesService.findAll();
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Tìm kiếm tiện ích theo từ khóa' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm tiện ích' })
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.search(query, req.user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết tiện ích' })
  @ApiResponse({ status: 200, description: 'Thông tin tiện ích' })
  @ResponseMessage('Lấy tiện ích thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Cập nhật thông tin tiện ích' })
  @ApiResponse({
    status: 200,
    description: 'Tiện ích được cập nhật thành công',
  })
  @ResponseMessage('Cập nhật tiện ích thành công')
  update(
    @Param('id') id: string,
    @Body() updateAmenityDto: UpdateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.update(id, updateAmenityDto, req.user!);
  }

  @Delete(':id')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Xóa tiện ích (soft delete)' })
  @ApiResponse({ status: 200, description: 'Tiện ích được xóa thành công' })
  @ResponseMessage('Xóa tiện ích thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.softDelete(id, req.user!);
  }

  @Patch(':id/toggle-status')
  @RequirePermission('amenity.manage')
  @ApiOperation({ summary: 'Thay đổi trạng thái tiện ích (active/inactive)' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái tiện ích được thay đổi',
  })
  @ResponseMessage('Cập nhật trạng thái tiện ích thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.toggleStatus(id, req.user!);
  }
}
