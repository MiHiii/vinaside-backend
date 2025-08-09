import { Injectable } from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { PropertyStaffAssignmentService } from '../../modules/property-staff-assignment/property-staff-assignment.service';
import { AssignmentStatus } from '../../modules/property-staff-assignment/schemas/property-staff-assignment.schema';
import { RequestWithStaffFilter } from '../../utils/staff-filter.util';

@Injectable()
export abstract class StaffFilteredBaseService {
  constructor(
    protected readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  /**
   * Apply staff property filter to query
   */
  protected applyStaffFilter<T>(
    filter: FilterQuery<T>,
    request?: RequestWithStaffFilter,
    propertyField: string = 'propertyId',
  ): FilterQuery<T> {
    if (!request?.user) {
      return filter;
    }

    const { user, staffPropertyIds } = request;

    // Admin có quyền truy cập tất cả
    if (user.role === 'admin') {
      return filter;
    }

    // Staff chỉ được truy cập properties được assign
    if (user.role === 'staff') {
      if (!staffPropertyIds || staffPropertyIds.length === 0) {
        // Staff không được assign property nào, return empty result
        return {
          ...filter,
          _id: { $in: [] }, // Force empty result
        } as FilterQuery<T>;
      }

      // Filter by assigned property IDs
      return {
        ...filter,
        [propertyField]: {
          $in: staffPropertyIds.map((id: string) => new Types.ObjectId(id)),
        },
      } as FilterQuery<T>;
    }

    // Các role khác không có quyền truy cập
    return {
      ...filter,
      _id: { $in: [] }, // Force empty result
    } as FilterQuery<T>;
  }

  /**
   * Get staff property IDs from request or calculate them
   */
  protected async getStaffPropertyIds(
    user: JwtPayload,
    request?: RequestWithStaffFilter,
  ): Promise<string[]> {
    // If already calculated in request, use it
    if (request?.staffPropertyIds) {
      return request.staffPropertyIds;
    }

    // Otherwise calculate them
    if (user.role === 'staff') {
      const assignments =
        await this.propertyStaffAssignmentService.getPropertiesByStaff(
          new Types.ObjectId(user._id),
        );

      return assignments
        .filter((assignment) => assignment.status === AssignmentStatus.ACTIVE)
        .map((assignment) => assignment.propertyId.toString());
    }

    return [];
  }

  /**
   * Check if user has access to specific property
   */
  protected async hasPropertyAccess(
    user: JwtPayload,
    propertyId: string,
    request?: RequestWithStaffFilter,
  ): Promise<boolean> {
    if (user.role === 'admin') {
      return true;
    }

    if (user.role === 'staff') {
      const staffPropertyIds = await this.getStaffPropertyIds(user, request);
      return staffPropertyIds.includes(propertyId);
    }

    return false;
  }

  /**
   * Create paginated result with staff filtering
   */
  protected createPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
