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
} from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityDto } from './dto/update-amenity.dto';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { Roles } from 'src/decorators/roles.decorator';
import { Public } from 'src/decorators/public.decorator';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @Roles('staff')
  @ResponseMessage('Tạo tiện ích thành công')
  create(
    @Body() createAmenityDto: CreateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.create(createAmenityDto, req.user!);
  }

  @Get()
  @Public()
  @ResponseMessage('Lấy danh sách tiện ích thành công')
  findAll(
    @Query() query: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.amenitiesService.findAll(query, req.user);
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.search(query, req.user);
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Lấy tiện ích thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('staff')
  @ResponseMessage('Cập nhật tiện ích thành công')
  update(
    @Param('id') id: string,
    @Body() updateAmenityDto: UpdateAmenityDto,
    @Request() req: RequestWithUser,
  ) {
    return this.amenitiesService.update(id, updateAmenityDto, req.user!);
  }

  @Delete(':id')
  @Roles('staff')
  @ResponseMessage('Xóa tiện ích thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.softDelete(id, req.user!);
  }

  @Patch(':id/toggle-status')
  @Roles('staff')
  @ResponseMessage('Cập nhật trạng thái tiện ích thành công')
  toggleStatus(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.amenitiesService.toggleStatus(id, req.user!);
  }
}
