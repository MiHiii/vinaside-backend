import { FilterQuery, Types } from 'mongoose';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface RequestWithStaffFilter {
  user?: JwtPayload;
  staffPropertyIds?: string[];
  staffFilterApplied?: boolean;
}

/**
 * Apply staff property filter to any query
 * @param filter - Original filter query
 * @param request - Request object with user and staffPropertyIds
 * @param propertyField - Field name containing property ID (default: 'propertyId')
 * @returns Filtered query
 */
export function applyStaffFilter<T>(
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
 * Check if user has access to specific property
 * @param user - User object
 * @param propertyId - Property ID to check
 * @param request - Request object with staffPropertyIds
 * @returns boolean
 */
export function hasPropertyAccess(
  user: JwtPayload,
  propertyId: string,
  request?: RequestWithStaffFilter,
): boolean {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'staff') {
    const staffPropertyIds = request?.staffPropertyIds || [];
    return staffPropertyIds.includes(propertyId);
  }

  return false;
}

/**
 * Create empty result for staff with no assigned properties
 * @param page - Current page
 * @param limit - Items per page
 * @returns Empty paginated result
 */
export function createEmptyResult(page: number = 1, limit: number = 10) {
  return {
    data: [],
    total: 0,
    page,
    limit,
    totalPages: 0,
  };
}
