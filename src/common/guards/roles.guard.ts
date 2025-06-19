import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // Kiểm tra nếu người dùng không có vai trò
    if (!request.user || !request.user.role) {
      throw new ForbiddenException(
        'Bạn cần đăng nhập với vai trò phù hợp để thực hiện thao tác này',
      );
    }

    // Kiểm tra vai trò của người dùng
    const hasRole = requiredRoles.some((role) => request.user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện thao tác này. Cần có vai trò: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
