'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CONFORMITE_ROOT } from '../hooks';
import type { LibraryEntry, LibraryQuery, NewLibraryDocument } from './model';
import { useLibrarySource } from './source';

export const libraryKeys = {
  list: (query: LibraryQuery) => [...CONFORMITE_ROOT, 'library', query] as const,
};

export const useLibraryPermissions = () => useLibrarySource().permissions;

export function useLibraryEntries(query: LibraryQuery) {
  const source = useLibrarySource();
  const result = useInfiniteQuery({
    queryKey: libraryKeys.list(query),
    queryFn: ({ pageParam }) => source.list(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });
  return {
    items: result.data?.pages.flatMap((page) => page.items) ?? [],
    isPending: result.isPending,
    isError: result.isError,
    error: result.isError ? result.error : null,
    hasMore: result.hasNextPage,
    isLoadingMore: result.isFetchingNextPage,
    loadMore: () => { void result.fetchNextPage(); },
    retry: () => { void result.refetch(); },
  };
}

function useLibraryMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: CONFORMITE_ROOT }),
  });
}

export function useFileLibraryDocument() {
  const source = useLibrarySource();
  return useLibraryMutation((input: NewLibraryDocument) => source.file(input));
}

export function useArchiveLibraryDocument() {
  const source = useLibrarySource();
  return useLibraryMutation((entry: LibraryEntry) => source.archive(entry.id));
}

export function useRestoreLibraryDocument() {
  const source = useLibrarySource();
  return useLibraryMutation((entry: LibraryEntry) => source.restore(entry.id));
}

export function useLibraryDownload() {
  const source = useLibrarySource();
  return useMutation({ mutationFn: (entry: LibraryEntry) => source.downloadFile(entry.file.id) });
}
