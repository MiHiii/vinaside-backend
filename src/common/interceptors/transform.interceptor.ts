import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse } from 'express';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY } from '../../decorators/response-message.decorator';

export interface ResponseData<T> {
  success: boolean;
  data: T;
  statusCode: number;
  message?: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseData<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseData<T>> {
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const statusCode = response.statusCode;

    const customMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data: unknown): ResponseData<T> => {
        // Safely check if data is an object with a message property
        const isDataObject = data !== null && typeof data === 'object';
        const messageFromData =
          isDataObject && 'message' in data ? String(data.message) : undefined;

        // Prioritize message from controller, then from decorator
        const message = messageFromData ?? customMessage ?? '';

        // Remove message from data if present
        let cleanData: any = {};
        if (isDataObject) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { message: _unused, ...rest } = data as Record<string, unknown>;
          cleanData = rest;
        } else {
          cleanData = data;
        }

        return {
          success: true,
          data: cleanData as T,
          statusCode,
          message,
        };
      }),
    );
  }
}
