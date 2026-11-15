import { useState } from "react";

export function usePagination<T>(items: readonly T[], pageSize: number) {
  const [requested, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requested, pages);
  return {
    page,
    setPage,
    pageSize,
    total: items.length,
    slice: items.slice((page - 1) * pageSize, page * pageSize),
  };
}
