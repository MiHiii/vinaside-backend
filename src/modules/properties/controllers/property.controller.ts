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
  Request,
  UseGuards,
} from '@nestjs/common';
import { PropertyService } from '../services/property.service';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { QueryPropertyDto } from '../dto/query-property.dto';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseMessage } from '../../../decorators/response-message.decorator';
import { Public } from '../../../decorators/public.decorator';
import { UserWithPermissions } from '../../../interfaces/user-with-permissions.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: UserWithPermissions;
}

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @RequirePermission('property.create')
  @ApiOperation({ summary: 'Create new property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ResponseMessage('Property created successfully')
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.create(createPropertyDto, req.user);
  }

  @Get()
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Get all properties' })
  @ApiResponse({ status: 200, description: 'List of properties' })
  @ResponseMessage('Properties fetched successfully')
  findAll(@Query() queryDto: QueryPropertyDto) {
    return this.propertyService.findAll(queryDto);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public properties (active and verified)' })
  @ApiResponse({ status: 200, description: 'List of public properties' })
  @ResponseMessage('Public properties fetched successfully')
  findPublic(@Query() queryDto: QueryPropertyDto) {
    return this.propertyService.findAll({
      ...queryDto,
      status: 'active',
      isVerified: true,
    });
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Find properties nearby a location' })
  @ApiResponse({ status: 200, description: 'List of nearby properties' })
  @ResponseMessage('Nearby properties fetched successfully')
  findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number,
    @Query() queryDto: QueryPropertyDto,
  ) {
    return this.propertyService.findNearby(lat, lng, radius, queryDto);
  }

  @Get('stats')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Get property statistics' })
  @ApiResponse({ status: 200, description: 'Property statistics' })
  @ResponseMessage('Property statistics fetched successfully')
  getStats() {
    return this.propertyService.getStats();
  }

  @Get('my-properties')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Get current user properties' })
  @ApiResponse({ status: 200, description: 'User properties' })
  @ResponseMessage('User properties fetched successfully')
  getMyProperties(
    @Query() queryDto: QueryPropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.findByOwner(req.user._id, queryDto);
  }

  @Get('staff/:staffId')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Get properties assigned to a staff member' })
  @ApiResponse({ status: 200, description: 'Staff properties' })
  @ResponseMessage('Staff properties fetched successfully')
  getStaffProperties(
    @Param('staffId') staffId: string,
    @Query() queryDto: QueryPropertyDto,
  ) {
    return this.propertyService.findByStaff(staffId, queryDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiResponse({ status: 200, description: 'Property details' })
  @ResponseMessage('Property fetched successfully')
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Update property' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  @ResponseMessage('Property updated successfully')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.update(id, updatePropertyDto, req.user);
  }

  @Patch(':id/status')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Update property status' })
  @ApiResponse({
    status: 200,
    description: 'Property status updated successfully',
  })
  @ResponseMessage('Property status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.updateStatus(id, status, req.user);
  }

  @Patch(':id/verify')
  @RequirePermission('property.verify')
  @ApiOperation({ summary: 'Verify/unverify property' })
  @ApiResponse({
    status: 200,
    description: 'Property verification updated successfully',
  })
  @ResponseMessage('Property verification updated successfully')
  verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean) {
    return this.propertyService.verify(id, isVerified);
  }

  @Patch(':id/staff')
  @RequirePermission('property.edit')
  @ApiOperation({ summary: 'Assign staff to property' })
  @ApiResponse({ status: 200, description: 'Staff assigned successfully' })
  @ResponseMessage('Staff assigned successfully')
  assignStaff(
    @Param('id') id: string,
    @Body('staffIds') staffIds: string[],
    @Request() req: RequestWithUser,
  ) {
    return this.propertyService.assignStaff(id, staffIds, req.user);
  }

  @Delete(':id')
  @RequirePermission('property.delete')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete property (soft delete)' })
  @ApiResponse({ status: 204, description: 'Property deleted successfully' })
  @ResponseMessage('Property deleted successfully')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.propertyService.remove(id, req.user);
  }

  @Patch(':id/restore')
  @RequirePermission('property.delete')
  @ApiOperation({ summary: 'Restore deleted property' })
  @ApiResponse({ status: 200, description: 'Property restored successfully' })
  @ResponseMessage('Property restored successfully')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.propertyService.restore(id, req.user);
  }
}
