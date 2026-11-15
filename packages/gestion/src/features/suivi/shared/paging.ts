'use client';

import { useState } from 'react';

export const PAGE_SIZES = [5, 10, 25] as const;

export interface Paging<T> {
  page: number;
  pageSize: number;
  total: number;
  pageItems: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

export function usePaging<T>(items: readonly T[], initialSize: number): Paging<T> {
  const [requested, setRequested] = useState(1);
  const [pageSize, setSize] = useState(initialSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requested, pageCount);
  return {
    page,
    pageSize,
    total: items.length,
    pageItems: items.slice((page - 1) * pageSize, page * pageSize),
    setPage: setRequested,
    setPageSize: (size) => {
      setSize(size);
      setRequested(1);
    },
    reset: () => { setRequested(1); },
  };
}
