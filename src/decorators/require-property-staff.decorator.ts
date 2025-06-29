import { SetMetadata } from '@nestjs/common';

export const PROPERTY_STAFF_KEY = 'property_staff';

export interface PropertyStaffOptions {
  propertyIdSource: 'param' | 'body';
  propertyIdParam?: string; // tên param hoặc property chứa propertyId
}

export const RequirePropertyStaff = (
  options: PropertyStaffOptions | string = {
    propertyIdSource: 'param',
    propertyIdParam: 'propertyId',
  },
) => {
  // Nếu truyền string, mặc định là param name
  const normalizedOptions: PropertyStaffOptions =
    typeof options === 'string'
      ? { propertyIdSource: 'param', propertyIdParam: options }
      : options;

  return SetMetadata(PROPERTY_STAFF_KEY, normalizedOptions);
};
