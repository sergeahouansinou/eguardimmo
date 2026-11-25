"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Page } from "./schemas";

export const ORG_KEY = "org-modules" as const;

export function orgKey(module: string, ...parts: readonly unknown[]): QueryKey {
  return [ORG_KEY, module, ...parts];
}

export interface ClientQuery<T> {
  data: T | undefined;
  error: Error | null;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
}

const subscribeNothing = () => () => undefined;

function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

export function useOrgQuery<T>(key: QueryKey, load: () => Promise<T>, enabled = true): ClientQuery<T> {
  const hydrated = useHydrated();
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false });
  const refetch = () => {
    void query.refetch();
  };
  if (!hydrated) return { data: undefined, error: null, isPending: true, isError: false, isFetching: false, refetch };
  return { data: query.data, error: query.error, isPending: query.isPending && enabled, isError: query.isError, isFetching: query.isFetching, refetch };
}

export interface ClientInfinite<T> extends ClientQuery<T[]> {
  hasMore: boolean;
  fetchMore: () => void;
  isFetchingMore: boolean;
  moreError: Error | null;
}

export function useOrgInfinite<T>(key: QueryKey, load: (cursor: string | null) => Promise<Page<T>>): ClientInfinite<T> {
  const hydrated = useHydrated();
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => load(pageParam),
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });
  const refetch = () => {
    void query.refetch();
  };
  const fetchMore = () => {
    void query.fetchNextPage();
  };
  const items = query.data?.pages.flatMap((page) => page.items);
  if (!hydrated) return { data: undefined, error: null, isPending: true, isError: false, isFetching: false, refetch, hasMore: false, fetchMore, isFetchingMore: false, moreError: null };
  return {
    data: items,
    error: query.error,
    isPending: query.isPending,
    isError: query.isError && items === undefined,
    isFetching: query.isFetching,
    refetch,
    hasMore: query.hasNextPage,
    fetchMore,
    isFetchingMore: query.isFetchingNextPage,
    moreError: query.isFetchNextPageError ? query.error : null,
  };
}

export function useOrgMutation<Input, Output>(module: string, run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: [ORG_KEY, module] }),
  });
}
