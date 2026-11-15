'use client';

import { useState } from 'react';
import type { Sort } from '../lib/list';

export interface ListState {
  sort: Sort<string> | null;
  setSort: (sort: Sort<string> | null) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  restart: () => void;
}

export function useListState(initialSort: Sort<string> | null = null, initialPageSize = 10): ListState {
  const [sort, setSort] = useState<Sort<string> | null>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(initialPageSize);
  return {
    sort,
    setSort: (next) => {
      setSort(next);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (size) => {
      setSize(size);
      setPage(1);
    },
    restart: () => {
      setPage(1);
    },
  };
}
