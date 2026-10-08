import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { readRequestId, requestId } from './request-id';

function response(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    locals: {},
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  } as Response & { headers: Record<string, string> };
}

describe('request id', () => {
  it('assigns a server-generated id and ignores the client header', () => {
    const middleware = requestId();
    const req = { get: vi.fn(() => '../../secret') } as unknown as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers['X-Request-Id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.locals.requestId).toBe(res.headers['X-Request-Id']);
    expect(res.headers['X-Request-Id']).not.toContain('secret');
    expect(req.get).not.toHaveBeenCalled();
  });

  it('reads only a string id already stored on the response', () => {
    const res = response();
    expect(readRequestId(res)).toBe('-');
    res.locals.requestId = 'abc';
    expect(readRequestId(res)).toBe('abc');
  });
});
