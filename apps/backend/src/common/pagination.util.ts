import { PaginatedResult } from '@amader/shared';

export function paginationArgs(page = 1, pageSize = 20) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  page = 1,
  pageSize = 20,
): PaginatedResult<T> {
  return { items, total, page, pageSize };
}
