"use client";

import { ApiError } from "@eguardimmo/api";
import { useToast } from "@/components/roost/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigateTo } from "@/lib/navigate";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, signInHref } from "@/features/session/signIn";
import { describeFailure } from "@/marketplace/errors";
import { sebookKeys } from "@/marketplace/keys";
import { addFavorite, fetchFavoriteRefs, removeFavorite } from "@/marketplace/requests";

export function useFavoritesQuery(enabled: boolean) {
  const { client } = useSession();
  return useQuery({ queryKey: sebookKeys.favorites, queryFn: () => fetchFavoriteRefs(client), enabled });
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function useRedirectToSignIn(): () => void {
  const { authUrl } = useSession();
  return () => {
    const href = signInHref(authUrl, currentPageUrl());
    if (href) navigateTo(href);
  };
}

export function useToggleFavorite() {
  const { client } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const redirect = useRedirectToSignIn();
  return useMutation({
    mutationFn: ({ reference, next }: { reference: string; next: boolean }) => (next ? addFavorite(client, reference) : removeFavorite(client, reference)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sebookKeys.favorites }),
    onError: (error) => {
      if (isUnauthenticated(error)) {
        redirect();
        return;
      }
      toast.show({ tone: "danger", title: "Favori non enregistré", description: describeFailure(error).message });
    },
  });
}
