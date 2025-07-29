import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { PropertyStaffAssignmentService } from '../../modules/property-staff-assignment/property-staff-assignment.service';
import { Types } from 'mongoose';
import { AssignmentStatus } from '../../modules/property-staff-assignment/schemas/property-staff-assignment.schema';
import {
  STAFF_FILTERED_KEY,
  StaffFilterOptions,
} from '../../decorators/staff-filtered.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
  staffPropertyIds?: string[];
  staffFilterApplied?: boolean;
}

@Injectable()
export class StaffFilterInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Get decorator options
    const options = this.reflector.get<StaffFilterOptions>(
      STAFF_FILTERED_KEY,
      context.getHandler(),
    );

    // If no @StaffFiltered decorator, continue normally
    if (!options) {
      return next.handle();
    }

    // If user doesn't exist or auto filter is disabled, continue
    if (!user || !options.autoFilter) {
      return next.handle();
    }

    try {
      // Pre-calculate staff property IDs for use in service methods
      if (user.role === 'staff') {
        const assignments =
          await this.propertyStaffAssignmentService.getPropertiesByStaff(
            new Types.ObjectId(user._id),
          );

        const propertyIds = assignments
          .filter((assignment) => assignment.status === AssignmentStatus.ACTIVE)
          .map((assignment) => {
            // Handle both populated and unpopulated propertyId
            if (
              typeof assignment.propertyId === 'object' &&
              assignment.propertyId?._id
            ) {
              return assignment.propertyId._id.toString();
            }
            return assignment.propertyId.toString();
          });

        // Attach to request for service methods to use
        request.staffPropertyIds = propertyIds;
        request.staffFilterApplied = true;
      } else if (user.role === 'admin' && options.skipAdmin) {
        // Admin gets all access
        request.staffFilterApplied = true;
      }
    } catch (error) {
      console.error('Error in StaffFilterInterceptor:', error);
      // Continue with empty filter for security
      request.staffPropertyIds = [];
      request.staffFilterApplied = true;
    }

    return next.handle();
  }
}
