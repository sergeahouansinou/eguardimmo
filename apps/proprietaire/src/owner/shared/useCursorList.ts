"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { CursorPage } from "./model";

export interface CursorList<T, P extends CursorPage<T>> {
  items: T[];
  pages: readonly P[];
  loaded: boolean;
  failed: boolean;
  error: unknown;
  hasNext: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function useCursorList<T, P extends CursorPage<T> = CursorPage<T>>(
  key: readonly unknown[],
  load: (cursor: string | null) => Promise<P>,
  enabled = true,
): CursorList<T, P> {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: P) => last.nextCursor,
    enabled,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    pages,
    loaded: query.data !== undefined,
    failed: query.isError,
    error: query.error,
    hasNext: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    retry: () => void (query.data === undefined ? query.refetch() : query.fetchNextPage()),
  };
}
