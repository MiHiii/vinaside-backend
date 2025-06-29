import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PROPERTY_STAFF_KEY,
  PropertyStaffOptions,
} from '../../decorators/require-property-staff.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { PropertyService } from '../../modules/properties/services/property.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
  params: any;
  body: any;
}

@Injectable()
export class PropertyStaffGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private propertyService: PropertyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<PropertyStaffOptions>(
      PROPERTY_STAFF_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true; // No staff check required
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: JwtPayload = request.user;

    if (!user) {
      throw new ForbiddenException('User không được xác thực');
    }

    // ✅ Bypass if admin
    if (user.role === 'admin') {
      return true;
    }

    try {
      const propertyId = this.extractPropertyId(request, options);

      if (!propertyId) {
        throw new BadRequestException(
          'Không tìm thấy propertyId trong request',
        );
      }

      // Kiểm tra user có phải staff của property không
      const isStaff = await this.propertyService.isUserStaffOfProperty(
        propertyId,
        user._id,
      );

      if (!isStaff) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập resource này. Chỉ staff được gán cho property này mới có quyền.',
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new ForbiddenException('Lỗi khi kiểm tra quyền staff');
    }
  }

  private extractPropertyId(
    request: RequestWithUser,
    options: PropertyStaffOptions,
  ): string | null {
    const { propertyIdSource, propertyIdParam } = options;

    switch (propertyIdSource) {
      case 'param': {
        const params = request.params as Record<string, string>;
        const paramKey = propertyIdParam || 'propertyId';
        return params?.[paramKey] || null;
      }

      case 'body': {
        const body = request.body as Record<string, string>;
        const bodyKey = propertyIdParam || 'propertyId';
        return body?.[bodyKey] || null;
      }

      default:
        return null;
    }
  }
}
