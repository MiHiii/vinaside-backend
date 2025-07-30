import { SetMetadata } from '@nestjs/common';

export const STAFF_FILTERED_KEY = 'staff_filtered';

export interface StaffFilterOptions {
  /**
   * Auto apply staff filter to methods
   */
  autoFilter?: boolean;

  /**
   * Property field name to filter on (default: 'propertyId')
   */
  propertyField?: string;

  /**
   * Multiple property fields for complex queries
   */
  propertyFields?: string[];

  /**
   * Skip filter for admin role
   */
  skipAdmin?: boolean;

  /**
   * Custom filter logic name
   */
  filterType?: 'default' | 'multi' | 'stats';
}

/**
 * Decorator to mark methods that should apply staff property filtering
 *
 * Usage:
 * @StaffFiltered() - Basic filtering on propertyId
 * @StaffFiltered({ propertyField: 'property_id' }) - Custom property field
 * @StaffFiltered({ propertyFields: ['propertyId', 'listingId.propertyId'] }) - Multi-field
 * @StaffFiltered({ filterType: 'stats' }) - For statistics methods
 */
export const StaffFiltered = (options: StaffFilterOptions = {}) => {
  const defaultOptions: StaffFilterOptions = {
    autoFilter: true,
    propertyField: 'propertyId',
    skipAdmin: true,
    filterType: 'default',
    ...options,
  };

  return SetMetadata(STAFF_FILTERED_KEY, defaultOptions);
};
