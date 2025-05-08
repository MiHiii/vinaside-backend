import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`Request: ${req.method} ${req.originalUrl}`);

    // Get the start time
    const start = Date.now();

    // Once the response is finished, log the completed request
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `Response: ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
