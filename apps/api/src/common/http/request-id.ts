import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function createRequestId(): string {
  return randomUUID();
}

export function readRequestId(response: Response): string {
  const value = response.locals.requestId;
  return typeof value === 'string' && value.length > 0 ? value : '-';
}

export function requestId(): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, res, next) => {
    const id = createRequestId();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
