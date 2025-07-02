import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { PropertyService } from '../../modules/properties/services/property.service';
import {
  PROPERTY_STAFF_KEY,
  PropertyStaffOptions,
} from '../../decorators/require-property-staff.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class PropertyStaffGuard implements CanActivate {
  constructor(private readonly propertyService: PropertyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Get decorator options
    const reflector = new Reflector();
    const options = reflector.get<PropertyStaffOptions>(
      PROPERTY_STAFF_KEY,
      context.getHandler(),
    );

    // If no decorator applied, allow access
    if (!options) {
      return true;
    }

    try {
      // Check if user exists
      if (!user) {
        throw new UnauthorizedException('No user found');
      }

      // Admin bypass - admin can access any property
      if (user.role === 'admin') {
        return true;
      }

      // Extract propertyId from request
      const propertyId = this.extractPropertyId(request, options);

      if (!propertyId) {
        throw new ForbiddenException('Property ID not found');
      }

      // Check if user is staff of the property
      const isStaff = await this.propertyService.isUserStaffOfProperty(
        propertyId,
        user._id,
      );

      if (!isStaff) {
        throw new ForbiddenException(
          'You do not have permission to access this property.',
        );
      }

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new ForbiddenException(`Access denied: ${errorMessage}`);
    }
  }

  private extractPropertyId(
    request: RequestWithUser,
    options: PropertyStaffOptions,
  ): string | null {
    const { propertyIdSource, propertyIdParam } = options;

    switch (propertyIdSource) {
      case 'param': {
        const params = request.params;
        const paramKey = propertyIdParam || 'propertyId';
        return params?.[paramKey] || null;
      }

      case 'body': {
        const body = request.body as Record<string, any>;
        const bodyKey = propertyIdParam || 'propertyId';
        return (body?.[bodyKey] as string) || null;
      }

      default:
        return null;
    }
  }
}
