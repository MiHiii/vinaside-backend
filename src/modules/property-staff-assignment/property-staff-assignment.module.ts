import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PropertyStaffAssignment,
  PropertyStaffAssignmentSchema,
} from './schemas/property-staff-assignment.schema';
import { PropertyStaffAssignmentController } from './property-staff-assignment.controller';
import { PropertyStaffAssignmentService } from './property-staff-assignment.service';
import { PropertyStaffAssignmentRepo } from './property-staff-assignment.repo';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PropertyStaffAssignment.name,
        schema: PropertyStaffAssignmentSchema,
      },
    ]),
  ],
  controllers: [PropertyStaffAssignmentController],
  providers: [PropertyStaffAssignmentService, PropertyStaffAssignmentRepo],
  exports: [PropertyStaffAssignmentService, PropertyStaffAssignmentRepo],
})
export class PropertyStaffAssignmentModule {}
