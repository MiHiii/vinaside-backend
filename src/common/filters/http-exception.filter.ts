import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as
      | string
      | { message: string | string[]; statusCode: number; error: string };

    let errorMessage = '';
    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (Array.isArray(exceptionResponse.message)) {
      errorMessage = exceptionResponse.message[0];
    } else if (typeof exceptionResponse.message === 'string') {
      errorMessage = exceptionResponse.message;
    } else {
      errorMessage = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
