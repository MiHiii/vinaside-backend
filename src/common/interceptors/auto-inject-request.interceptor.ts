import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  INJECT_REQUEST_KEY,
  InjectRequestOptions,
} from '../../decorators/inject-request.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
  staffPropertyIds?: string[];
  staffFilterApplied?: boolean;
}

@Injectable()
export class AutoInjectRequestInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // Get decorator options
    const options = this.reflector.get<InjectRequestOptions>(
      INJECT_REQUEST_KEY,
      context.getHandler(),
    );

    // If no @InjectRequest decorator, continue normally
    if (!options) {
      return next.handle();
    }

    // If autoInject is disabled, continue
    if (!options.autoInject) {
      return next.handle();
    }

    // Store request in a way that services can access it
    // We'll use a global variable or attach to the request object
    (request as RequestWithUser & { injectedRequest?: any }).injectedRequest = {
      user: request.user,
      staffPropertyIds: request.staffPropertyIds,
      staffFilterApplied: request.staffFilterApplied,
    };

    return next.handle();
  }
}
