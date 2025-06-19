import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { ListingStatus } from './schemas/listing.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

interface SearchParams {
  // keyword?: string;
  priceFrom?: number;
  priceTo?: number;
  property_type?: string;
  guests?: number;
  amenities?: string[];
  location?: { lng: number; lat: number; radius?: number };
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: any;
}

@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  @Roles('host')
  @ResponseMessage('Tạo listing thành công')
  create(
    @Body() createListingDto: CreateListingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.create(createListingDto, req.user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách listings thành công')
  findAll(@Query() queryDto: QueryListingDto) {
    return this.listingService.findAll(queryDto);
  }

  @Public()
  @Get('active')
  @ResponseMessage('Lấy danh sách listings đang hoạt động thành công')
  findActive(@Query() queryDto: QueryListingDto) {
    return this.listingService.findActive(queryDto);
  }

  @Public()
  @Get('nearby')
  @ResponseMessage('Lấy danh sách listings gần vị trí thành công')
  findNearby(
    @Query('lng') lng: number,
    @Query('lat') lat: number,
    @Query('radius') radius: number,
    @Query() queryDto: QueryListingDto,
  ) {
    return this.listingService.findNearby({ lng, lat, radius }, queryDto);
  }

  @Public()
  @Get('search')
  @ResponseMessage('Tìm kiếm listings thành công')
  search(
    @Query() searchParams: SearchParams,
    @Query() queryDto: QueryListingDto,
  ) {
    return this.listingService.search(searchParams, queryDto);
  }

  @Get('admin/deleted')
  @Roles('admin')
  @ResponseMessage('Lấy danh sách listings đã xóa thành công')
  findDeleted(
    @Query() queryDto: QueryListingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.findDeleted(queryDto, req.user);
  }

  @Get(':id')
  @ResponseMessage('Lấy thông tin listing thành công')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Patch(':id')
  @Roles('host', 'admin')
  @ResponseMessage('Cập nhật listing thành công')
  update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.update(id, updateListingDto, req.user);
  }

  @Delete(':id')
  @Roles('host', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa listing thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.listingService.remove(id, req.user);
  }

  @Delete(':id/force')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa vĩnh viễn listing thành công')
  forceRemove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.listingService.forceRemove(id, req.user);
  }

  @Patch(':id/restore')
  @Roles('host', 'admin')
  @ResponseMessage('Khôi phục listing thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.listingService.restore(id, req.user);
  }

  @Patch(':id/verify')
  @Roles('admin')
  @ResponseMessage('Cập nhật trạng thái xác minh listing thành công')
  verify(
    @Param('id') id: string,
    @Body('is_verified') isVerified: boolean,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.verifyListing(id, isVerified, req.user);
  }

  @Patch(':id/status')
  @Roles('host', 'admin')
  @ResponseMessage('Cập nhật trạng thái listing thành công')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ListingStatus,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.updateStatus(id, status, req.user);
  }

  @Get('host/:hostId')
  @ResponseMessage('Lấy danh sách listings của host thành công')
  findByHost(
    @Param('hostId') hostId: string,
    @Query() queryDto: QueryListingDto,
  ) {
    return this.listingService.findByHost(hostId, queryDto);
  }
}
