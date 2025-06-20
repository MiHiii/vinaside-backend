import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Check if the request is for WebSocket
    const request: unknown = context.switchToHttp().getRequest();
    if (
      typeof request === 'object' &&
      request !== null &&
      'url' in request &&
      typeof (request as { url?: unknown }).url === 'string' &&
      (request as { url: string }).url.includes('/socket.io/')
    ) {
      return true;
    }

    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: { name: string }): any {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token sai ở jwt auth');
      }
      throw err || new UnauthorizedException('No authorization token provided');
    }

    return user;
  }
}
