"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useFavoritesQuery, useToggleFavorite } from "@/features/favorites/queries";
import { useAuth } from "@/lib/auth";
import type { Listing } from "@/lib/roost-data";
import { sebookKeys } from "@/marketplace/keys";
import { toListing } from "@/marketplace/roost";
import type { ListingSummary } from "@/marketplace/schemas";

export interface FavoritesApi {
  isFavorite: (reference: string) => boolean;
  toggle: (reference: string) => Promise<void>;
  favorites: Listing[];
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useFavorites(): FavoritesApi {
  const { isAuthenticated } = useAuth();
  const query = useFavoritesQuery(isAuthenticated);
  const queryClient = useQueryClient();
  const toggleMutation = useToggleFavorite();
  const refs = useMemo(() => new Set((query.data ?? []).map((item) => item.public_ref)), [query.data]);
  const favorites = useMemo(() => (query.data ?? []).map(toListing), [query.data]);

  const isFavorite = useCallback((reference: string) => refs.has(reference), [refs]);
  const toggle = useCallback(
    async (reference: string) => {
      const next = !refs.has(reference);
      const previous = queryClient.getQueryData<ListingSummary[]>(sebookKeys.favorites);
      if (!next && previous) {
        queryClient.setQueryData<ListingSummary[]>(sebookKeys.favorites, previous.filter((item) => item.public_ref !== reference));
      }
      try {
        await toggleMutation.mutateAsync({ reference, next });
      } catch {
        queryClient.setQueryData(sebookKeys.favorites, previous);
      }
    },
    [refs, queryClient, toggleMutation],
  );
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return { isFavorite, toggle, favorites, count: refs.size, loading: isAuthenticated && query.isPending, refresh };
}
