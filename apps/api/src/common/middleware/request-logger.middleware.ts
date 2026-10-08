import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { readRequestId } from '../http/request-id';

export function requestLogger(): (req: Request, res: Response, next: NextFunction) => void {
  const logger = new Logger('HTTP');

  return (req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      if (req.path.startsWith('/api/docs')) {
        return;
      }

      const line = `${readRequestId(res)} ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`;
      if (res.statusCode >= 500) {
        logger.error(line);
        return;
      }

      logger.log(line);
    });

    next();
  };
}
