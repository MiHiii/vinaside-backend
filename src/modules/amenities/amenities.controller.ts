import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Req,
  Query,
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

@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @Roles('host')
  @ResponseMessage('Tạo tiện ích thành công')
  create(
    @Body() createAmenityDto: CreateAmenityDto,
    @Req() req: AuthenticatedRequest,
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
    return this.amenitiesService.findAllWithUserContext(query, req.user);
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.searchWithUserContext(query, req.user);
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Lấy tiện ích thành công')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.findOneWithUserContext(id, req.user);
  }

  @Put(':id')
  @Roles('host')
  @ResponseMessage('Cập nhật tiện ích thành công')
  update(
    @Param('id') id: string,
    @Body() updateAmenityDto: UpdateAmenityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.amenitiesService.update(id, updateAmenityDto, req.user!);
  }

  @Delete(':id')
  @Roles('host')
  @ResponseMessage('Xóa tiện ích thành công')
  softDelete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.softDelete(id, req.user!);
  }

  @Put('restore/:id')
  @Roles('host')
  @ResponseMessage('Khôi phục tiện ích thành công')
  restore(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.amenitiesService.restore(id, req.user!);
  }
}
