import type { PaginatedResponse } from "@/features/auth/types";

export function toPaginated<T>(
  value: T[] | PaginatedResponse<T>,
): PaginatedResponse<T> {
  if (Array.isArray(value)) {
    return {
      items: value,
      pagination: {
        page: 1,
        items_per_page: value.length,
        total_items: value.length,
        total_pages: 1,
      },
    };
  }
  return value;
}
