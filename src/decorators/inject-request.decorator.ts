import { SetMetadata } from '@nestjs/common';

export const INJECT_REQUEST_KEY = 'inject_request';

export interface InjectRequestOptions {
  /**
   * Property field to filter on (default: 'propertyId')
   */
  propertyField?: string;

  /**
   * Whether to inject request automatically
   */
  autoInject?: boolean;
}

/**
 * Decorator to mark methods that should have request injected
 * This allows the method to access user and staffPropertyIds
 */
export const InjectRequest = (options: InjectRequestOptions = {}) => {
  const defaultOptions: InjectRequestOptions = {
    propertyField: 'propertyId',
    autoInject: true,
    ...options,
  };

  return SetMetadata(INJECT_REQUEST_KEY, defaultOptions);
};
