export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type PaginatedResult<T> = {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  startItemNumber: number;
  endItemNumber: number;
};

export function paginateResults<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const totalItems = items.length;

  if (totalItems === 0) {
    return {
      items: [],
      totalItems,
      totalPages: 0,
      currentPage: 0,
      startItemNumber: 0,
      endItemNumber: 0
    };
  }

  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage,
    startItemNumber: startIndex + 1,
    endItemNumber: Math.min(endIndex, totalItems)
  };
}