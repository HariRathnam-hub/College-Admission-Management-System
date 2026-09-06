/**
 * Shared pagination helpers so every list endpoint (programs, students,
 * applications, notifications, ...) computes skip/take and the response
 * `meta` block the same way.
 */

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export function getPagination(query: PaginationQuery): PaginationParams {
  const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
  const limit = query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
