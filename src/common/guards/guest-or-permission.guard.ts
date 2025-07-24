import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../../decorators/require-permission.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { RbacService } from '../../modules/auth/services/rbac.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Injectable()
export class GuestOrPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Bạn cần đăng nhập để thực hiện thao tác này',
      );
    }

    // Nếu user là admin, luôn cho phép
    if (user.role === 'admin') {
      return true;
    }

    // Nếu user có role là guest
    if (user.role === 'guest') {
      return true;
    }

    // Nếu user có permission
    if (requiredPermission) {
      const hasPermission = await this.rbacService.userHasPermission(
        user._id,
        requiredPermission,
      );
      if (hasPermission) return true;
    }

    throw new ForbiddenException('Bạn không có quyền thực hiện hành động này');
  }
}
