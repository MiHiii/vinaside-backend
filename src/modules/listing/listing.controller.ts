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
import {
  ListingStatisticsDto,
  ListingStatisticsResponseDto,
} from './dto/listing-statistics.dto';

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
import { StaffFiltered } from '../../decorators/staff-filtered.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
  staffPropertyIds?: string[];
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

  // =================== ADMIN/STAFF ENDPOINTS ===================

  @Get('admin')
  @RequirePermission('listing.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({
    summary:
      'Lấy tất cả listing với phân trang (Admin: tất cả, Staff: chỉ assigned properties)',
    description:
      'Hỗ trợ phân trang với page và limit. Ví dụ: ?page=1&limit=10 hoặc ?page=2&limit=10',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách listing với metadata phân trang',
    schema: {
      type: 'object',
      properties: {
        listings: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', description: 'Tổng số listing' },
            page: { type: 'number', description: 'Trang hiện tại' },
            limit: { type: 'number', description: 'Số item mỗi trang' },
            totalPages: { type: 'number', description: 'Tổng số trang' },
          },
        },
      },
    },
  })
  @ResponseMessage('Lấy danh sách listing thành công')
  findAllAdmin(
    @Query() queryListingDto: QueryListingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.listingService.findAll(queryListingDto, req.user, req);
  }

  @Get('admin/:id')
  @RequirePermission('listing.view')
  @StaffFiltered({ propertyField: 'propertyId' })
  @ApiOperation({
    summary: 'Xem chi tiết listing cho Admin/Staff (bao gồm cả INACTIVE)',
    description:
      'Admin và Staff có thể xem chi tiết listing ở mọi trạng thái including INACTIVE. Trả về dữ liệu giống hệt API findOne.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Chi tiết listing (bao gồm cả trạng thái INACTIVE) - cấu trúc dữ liệu giống API findOne',
  })
  @ResponseMessage('Lấy chi tiết listing thành công')
  findOneForAdmin(@Param('id') id: string) {
    return this.listingService.findOneForStaff(id);
  }

  // =================== PUBLIC ENDPOINTS ===================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Tìm tất cả listing với bộ lọc (Public)' })
  @ResponseMessage('Listings fetched successfully')
  findAll(@Query() queryListingDto: QueryListingDto, @Request() req: any) {
    let user: JwtPayload | undefined = undefined;
    if (
      req &&
      typeof req === 'object' &&
      Object.prototype.hasOwnProperty.call(req, 'user')
    ) {
      user = (req as { user: JwtPayload }).user;
    }
    // Public endpoint - không cần staff filtering
    return this.listingService.findAll(queryListingDto, user, null);
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
  @Get('top/rated')
  @ApiOperation({ summary: 'Lấy top listings theo rating' })
  @ApiResponse({
    status: 200,
    description: 'Top listings theo rating được trả về thành công.',
  })
  @ResponseMessage('Top rated listings fetched successfully')
  getTopRatedListings(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.listingService.getTopRatedListings(limitNumber);
  }

  @Public()
  @Get('top/wishlist')
  @ApiOperation({ summary: 'Lấy top listings theo số lượt yêu thích' })
  @ApiResponse({
    status: 200,
    description: 'Top listings theo wishlist count được trả về thành công.',
  })
  @ResponseMessage('Top wishlist listings fetched successfully')
  getTopWishlistListings(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.listingService.getTopWishlistListings(limitNumber);
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

  // =================== STATISTICS ENDPOINTS ===================
  @Get('statistics/:id')
  @RequirePermission('listing.view')
  @ApiOperation({
    summary: 'Lấy thống kê chi tiết cho một listing',
    description:
      'Lấy thống kê chi tiết bao gồm booking, revenue, occupancy, reviews với date range filter',
  })
  @ApiResponse({
    status: 200,
    description:
      'Thống kê listing với chart data và date range. Chi tiết schema xem ListingService.getListingStatistics()',
  })
  @ResponseMessage('Lấy thống kê listing thành công')
  async getListingStatistics(
    @Param('id') id: string,
    @Query() queryDto: ListingStatisticsDto,
    @Request() req: RequestWithUser,
  ): Promise<ListingStatisticsResponseDto> {
    return this.listingService.getListingStatistics(id, queryDto, req.user);
  }

  // =================== LOCATION-BASED ENDPOINTS ===================

  @Get('location/nearby')
  @Public()
  @ApiOperation({
    summary:
      'Tìm listings gần vị trí cụ thể với tính toán khoảng cách chính xác',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách listings gần vị trí được trả về thành công.',
  })
  @ResponseMessage('Lấy danh sách listings gần vị trí thành công')
  async findListingsByLocation(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 10,
    @Query() queryDto: QueryListingDto,
  ) {
    return this.listingService.findListingsByLocation(
      lat,
      lng,
      radius,
      queryDto,
    );
  }

  @Public()
  @Get('search/availability')
  @ApiOperation({
    summary:
      'Tìm kiếm listings theo tính khả dụng (ngày nhận phòng, ngày trả phòng, số khách)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách listings có sẵn được trả về thành công.',
  })
  @ResponseMessage('Tìm kiếm listings theo tính khả dụng thành công')
  async searchByAvailability(
    @Query() queryDto: QueryListingDto,
    @Request() req: any,
  ) {
    let user: JwtPayload | undefined = undefined;
    if (
      req &&
      typeof req === 'object' &&
      Object.prototype.hasOwnProperty.call(req, 'user')
    ) {
      user = (req as { user: JwtPayload }).user;
    }

    // Đảm bảo có ít nhất một trong các tham số tìm kiếm theo ngày
    if (!queryDto.checkInDate && !queryDto.checkOutDate) {
      return {
        listings: [],
        meta: {
          total: 0,
          page: queryDto.page || 1,
          limit: queryDto.limit || 20,
          totalPages: 0,
        },
        message: 'Vui lòng cung cấp ngày nhận phòng hoặc ngày trả phòng',
      };
    }

    return this.listingService.findAll(queryDto, user, null);
  }
}
