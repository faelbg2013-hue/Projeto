import type { PaginationMeta } from '@ravion/types';

export function pageWindow(query: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
