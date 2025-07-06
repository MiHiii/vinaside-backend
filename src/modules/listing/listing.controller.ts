import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Patch,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { ListingService } from './listing.service';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { Public } from '../../decorators/public.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from 'src/decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { PropertyStaffGuard } from '../../common/guards/property-staff.guard';
import { RequirePropertyStaff } from '../../decorators/require-property-staff.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Listings')
@Controller('listings')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
@ApiBearerAuth()
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  // =================== PROTECTED ENDPOINTS ===================

  @Post()
  @RequirePermission('listing.create')
  @RequirePropertyStaff({
    propertyIdSource: 'body',
    propertyIdParam: 'propertyId',
  })
  @ApiOperation({ summary: 'Tạo listing mới' })
  @ApiResponse({ status: 201, description: 'Listing được tạo thành công.' })
  @ApiResponse({ status: 403, description: 'Bị cấm.' })
  @ResponseMessage('Listing created successfully')
  create(
    @Body() createListingDto: CreateListingDto,
    @Request() req: RequestWithUser,
  ): Promise<Listing> {
    return this.listingService.create(createListingDto, req.user);
  }

  @Put('property/:propertyId/:id')
  @RequirePermission('listing.edit')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Cập nhật listing' })
  @ApiResponse({
    status: 200,
    description: 'Listing được cập nhật thành công.',
  })
  @ResponseMessage('Listing updated successfully')
  update(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Request() req: RequestWithUser,
  ): Promise<Listing> {
    return this.listingService.update(id, updateListingDto, req.user);
  }

  @Delete('property/:propertyId/:id')
  @RequirePermission('listing.delete')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Xóa mềm listing' })
  @ApiResponse({ status: 200, description: 'Listing được xóa thành công.' })
  @ResponseMessage('Listing deleted successfully')
  remove(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.remove(id, req.user);
  }

  @Patch('property/:propertyId/:id/restore')
  @RequirePermission('listing.restore')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Khôi phục listing đã xóa' })
  @ApiResponse({
    status: 200,
    description: 'Listing được khôi phục thành công',
  })
  @ResponseMessage('Listing restored successfully')
  restore(@Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.listingService.restore(id);
  }

  @Patch('property/:propertyId/:id/status')
  @RequirePermission('listing.manage_status')
  @RequirePropertyStaff('propertyId')
  @ApiOperation({ summary: 'Cập nhật trạng thái listing' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái được cập nhật thành công.',
  })
  @ResponseMessage('Listing status updated successfully')
  updateStatus(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body('status') status: ListingStatus,
    @Request() req: RequestWithUser,
  ): Promise<Listing> {
    return this.listingService.updateStatus(id, status, req.user);
  }

  // =================== PUBLIC ENDPOINTS ===================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Tìm tất cả listing với bộ lọc' })
  @ResponseMessage('Listings fetched successfully')
  findAll(@Query() queryListingDto: QueryListingDto) {
    return this.listingService.findAll(queryListingDto);
  }

  @Public()
  @Get('top/viewed')
  @ApiOperation({ summary: 'Lấy top listings theo số lượt xem' })
  @ApiResponse({
    status: 200,
    description: 'Top listings theo view count được trả về thành công.',
  })
  @ResponseMessage('Top viewed listings fetched successfully')
  getTopViewedListings(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.listingService.getTopViewedListings(limitNumber);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Tìm listing theo ID' })
  @ResponseMessage('Listing fetched successfully')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Public()
  @Get(':id/view')
  @ApiOperation({ summary: 'Xem chi tiết listing và tăng số lượt xem' })
  @ApiResponse({
    status: 200,
    description: 'Listing được tìm thấy và view count được tăng.',
  })
  @ResponseMessage('Listing viewed successfully')
  findOneAndIncrementView(@Param('id') id: string) {
    return this.listingService.findOneAndIncrementView(id);
  }
}
