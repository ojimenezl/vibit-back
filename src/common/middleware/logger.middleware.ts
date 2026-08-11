import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const started = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - started;
      this.logger.log(`${method} ${originalUrl} ${res.statusCode} +${ms}ms`);
    });

    next();
  }
}
