'use client';

import { useState } from 'react';

export interface ListTab<T> {
  id: string;
  label: string;
  match: (item: T) => boolean;
}

export const fold = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export interface ListView<T> {
  tab: string;
  setTab: (tab: string) => void;
  query: string;
  setQuery: (query: string) => void;
  page: number;
  setPage: (page: number) => void;
  resetPage: () => void;
  pageSize: number;
  total: number;
  rows: T[];
  filtered: T[];
  counts: Record<string, number>;
}

export function useListView<T>({
  items,
  tabs,
  searchText,
  predicate,
  pageSize = 10,
}: {
  items: readonly T[];
  tabs: readonly ListTab<T>[];
  searchText: (item: T) => string;
  predicate?: (item: T) => boolean;
  pageSize?: number;
}): ListView<T> {
  const [tab, setTabState] = useState(tabs[0]?.id ?? '');
  const [query, setQueryState] = useState('');
  const [page, setPage] = useState(1);

  const counts: Record<string, number> = {};
  for (const entry of tabs) counts[entry.id] = items.filter((item) => entry.match(item)).length;

  const active = tabs.find((entry) => entry.id === tab);
  const needle = fold(query.trim());
  const filtered = items.filter(
    (item) =>
      (active ? active.match(item) : true) &&
      (predicate ? predicate(item) : true) &&
      (needle === '' || fold(searchText(item)).includes(needle)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);

  return {
    tab,
    setTab: (next) => {
      setTabState(next);
      setPage(1);
    },
    query,
    setQuery: (next) => {
      setQueryState(next);
      setPage(1);
    },
    page: current,
    setPage,
    resetPage: () => { setPage(1); },
    pageSize,
    total: filtered.length,
    rows: filtered.slice((current - 1) * pageSize, current * pageSize),
    filtered,
    counts,
  };
}
