/**
 * Reusable Pagination Utility
 * Provides shared pagination parsing, clamping, and response shaping.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

/**
 * Parse and clamp pagination query parameters.
 *
 * @param query Express `req.query` object
 * @returns Normalised pagination params ready for Prisma `skip` / `take`
 */
export function parsePagination(
  query: Record<string, unknown>,
): PaginationParams {
  let page = Number(query.page) || DEFAULT_PAGE;
  let limit = Number(query.limit) || DEFAULT_LIMIT;

  page = Math.max(1, Math.floor(page));
  limit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(limit)));

  const sort = typeof query.sort === 'string' ? query.sort : undefined;
  const order =
    typeof query.order === 'string' && query.order === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort,
    order,
  };
}

/**
 * Shape a paginated API response.
 */
export function paginatedResult<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data: items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
