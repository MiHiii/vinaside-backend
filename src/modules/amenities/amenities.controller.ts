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
  NotFoundException,
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
    if (req.user?.role === 'host') {
      const userQuery = { ...query, createdBy: req.user._id };
      return this.amenitiesService.findAll(userQuery);
    } else {
      const publicQuery = { ...query, isDeleted: false, is_active: true };
      return this.amenitiesService.findAll(publicQuery);
    }
  }

  @Get('search')
  @Public()
  @ResponseMessage('Tìm kiếm tiện ích thành công')
  search(@Query('query') query: string, @Req() req: AuthenticatedRequest) {
    if (req.user?.role === 'host') {
      return this.amenitiesService.search(query, req.user._id);
    } else {
      return this.amenitiesService.search(query, undefined, {
        isDeleted: false,
        is_active: true,
      });
    }
  }

  @Get(':id')
  @Public()
  @ResponseMessage('Lấy tiện ích thành công')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (req.user?.role === 'host') {
      // Host xem amenity của mình
      return this.amenitiesService.findOne(id, req.user._id);
    } else {
      const results = await this.amenitiesService.findAll(
        { _id: id, isDeleted: false, is_active: true },
        { limit: 1 },
      );

      if (!results || results.length === 0) {
        throw new NotFoundException('Amenity not found or not available');
      }

      return results[0];
    }
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
