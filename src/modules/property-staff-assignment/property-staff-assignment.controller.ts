import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RequirePermission } from 'src/decorators/require-permission.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { PropertyStaffAssignmentService } from './property-staff-assignment.service';
import {
  AssignStaffDto,
  UnassignStaffDto,
  GetStaffAssignmentsDto,
} from './dto/property-staff-assignment.dto';
import { ParseMongoIdPipe } from 'src/pipes/parse-mongo-id.pipe';
import { Types } from 'mongoose';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('property-staff-assignment')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyStaffAssignmentController {
  constructor(
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  @Post('assign')
  @RequirePermission('property_staff.edit')
  async assignStaff(
    @Body() assignStaffDto: AssignStaffDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyStaffAssignmentService.assignStaff(
      assignStaffDto,
      req.user._id,
    );
  }

  @Post('unassign')
  @RequirePermission('property_staff.edit')
  async unassignStaff(
    @Body() unassignStaffDto: UnassignStaffDto,
    @Request() req: RequestWithUser,
  ) {
    return this.propertyStaffAssignmentService.unassignStaff(
      unassignStaffDto,
      req.user._id,
    );
  }

  @Get('property/:propertyId/staff')
  @RequirePermission('property_staff.view')
  async getStaffByProperty(
    @Param('propertyId', ParseMongoIdPipe) propertyId: Types.ObjectId,
  ) {
    return this.propertyStaffAssignmentService.getStaffByProperty(propertyId);
  }

  @Get('staff/:staffId/properties')
  @RequirePermission('property_staff.view')
  async getPropertiesByStaff(
    @Param('staffId', ParseMongoIdPipe) staffId: Types.ObjectId,
  ) {
    return this.propertyStaffAssignmentService.getPropertiesByStaff(staffId);
  }

  @Get('history')
  @RequirePermission('property_staff.view')
  async getAssignmentHistory(@Query() queryDto: GetStaffAssignmentsDto) {
    return this.propertyStaffAssignmentService.getAssignmentHistory(queryDto);
  }

  @Get('check/:staffId/:propertyId')
  @RequirePermission('property_staff.view')
  async checkStaffAssignment(
    @Param('staffId', ParseMongoIdPipe) staffId: Types.ObjectId,
    @Param('propertyId', ParseMongoIdPipe) propertyId: Types.ObjectId,
  ) {
    const isAssigned =
      await this.propertyStaffAssignmentService.isStaffAssignedToProperty(
        staffId,
        propertyId,
      );
    return { isAssigned };
  }

  @Get('all')
  @RequirePermission('property_staff.view')
  async getAllAssignments() {
    return this.propertyStaffAssignmentService.getAllAssignments();
  }
}
