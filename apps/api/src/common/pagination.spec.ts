import { describe, expect, it } from 'vitest';
import { pageMeta, pageWindow } from './pagination';

describe('pagination', () => {
  it('uses the API defaults when the query omits page and pageSize', () => {
    expect(pageWindow({})).toEqual({ page: 1, pageSize: 20, skip: 0 });
    expect(pageWindow({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, skip: 20 });
  });

  it('returns an empty page count when there are no rows', () => {
    expect(pageMeta(1, 20, 0)).toEqual({ page: 1, pageSize: 20, total: 0, pageCount: 0 });
    expect(pageMeta(2, 20, 21).pageCount).toBe(2);
  });
});
