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
  Req,
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
import { UserWithPermissions } from '../../interfaces/user-with-permissions.interface';
import { Listing, ListingStatus } from './schemas/listing.schema';
import { Public } from '../../decorators/public.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from 'src/decorators/require-permission.decorator';
import { ResponseMessage } from '../../decorators/response-message.decorator';

@ApiTags('Listings')
@Controller('listings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  // =================== PROTECTED ENDPOINTS ===================

  @Post()
  @RequirePermission('listing.create')
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ResponseMessage('Listing created successfully')
  create(
    @Body() createListingDto: CreateListingDto,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.create(createListingDto, user);
  }

  @Put(':id')
  @RequirePermission('listing.edit')
  @ApiOperation({ summary: 'Update a listing' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully.' })
  @ResponseMessage('Listing updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.update(id, updateListingDto, user);
  }

  @Delete(':id')
  @RequirePermission('listing.delete')
  @ApiOperation({ summary: 'Soft delete a listing' })
  @ApiResponse({ status: 200, description: 'Listing deleted successfully.' })
  @ResponseMessage('Listing deleted successfully')
  remove(@Param('id') id: string, @Req() user: UserWithPermissions) {
    return this.listingService.remove(id, user);
  }

  @Patch(':id/restore')
  @RequirePermission('listing.delete')
  @ApiOperation({ summary: 'Restore a soft-deleted listing' })
  @ApiResponse({ status: 200, description: 'Listing restored successfully.' })
  @ResponseMessage('Listing restored successfully')
  restore(
    @Param('id') id: string,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.restore(id, user);
  }

  @Patch(':id/status')
  @RequirePermission('listing.manage_status')
  @ApiOperation({ summary: 'Update listing status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully.' })
  @ResponseMessage('Listing status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ListingStatus,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.updateStatus(id, status, user);
  }

  // =================== PUBLIC ENDPOINTS ===================

  @Public()
  @Get()
  @ApiOperation({ summary: 'Find all listings with filters' })
  @ResponseMessage('Listings fetched successfully')
  findAll(@Query() queryListingDto: QueryListingDto) {
    return this.listingService.findAll(queryListingDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Find a listing by ID' })
  @ResponseMessage('Listing fetched successfully')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }
}
