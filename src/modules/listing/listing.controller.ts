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
import { RequirePermission } from 'src/decorators/require-permission.decorator';

@ApiTags('Listings')
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  // =================== PROTECTED ENDPOINTS ===================

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('listing.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing' })
  @ApiResponse({ status: 201, description: 'Listing created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(
    @Body() createListingDto: CreateListingDto,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.create(createListingDto, user);
  }

  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('listing.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a listing' })
  @ApiResponse({ status: 200, description: 'Listing updated successfully.' })
  update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.update(id, updateListingDto, user);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('listing.delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a listing' })
  @ApiResponse({ status: 200, description: 'Listing deleted successfully.' })
  remove(@Param('id') id: string, @Req() user: UserWithPermissions) {
    return this.listingService.remove(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(PermissionGuard)
  @RequirePermission('listing.restore')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore a soft-deleted listing' })
  @ApiResponse({ status: 200, description: 'Listing restored successfully.' })
  restore(
    @Param('id') id: string,
    @Req() user: UserWithPermissions,
  ): Promise<Listing> {
    return this.listingService.restore(id, user);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @RequirePermission('listing.update.status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update listing status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully.' })
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
  findAll(@Query() queryListingDto: QueryListingDto) {
    return this.listingService.findAll(queryListingDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Find a listing by ID' })
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }
}
