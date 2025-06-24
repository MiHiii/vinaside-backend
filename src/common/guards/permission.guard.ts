import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../../decorators/require-permission.decorator';
import { UserWithPermissions } from '../../interfaces/user-with-permissions.interface';

interface RequestWithUser extends Request {
  user: UserWithPermissions;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: UserWithPermissions = request.user;

    if (!user) {
      return false; // No user found
    }

    // ✅ Bypass if admin
    if (user.role === 'admin') {
      return true;
    }

    // Check if user has the required permission
    return user.permissions?.includes(requiredPermission) || false;
  }
}
