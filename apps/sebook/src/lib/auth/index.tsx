"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useMe } from "@/features/session/queries";
import { useSession } from "@/features/session/SessionProvider";
import { currentPageUrl, signInHref, signUpHref } from "@/features/session/signIn";
import { navigateTo } from "@/lib/navigate";
import { sebookKeys } from "@/marketplace/keys";
import { logout as requestLogout } from "@/marketplace/requests";

export type AuthMode = "login" | "register";

export interface AuthUser {
  name: string;
  verified: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  openAuth: (mode: AuthMode) => void;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const me = useMe();
  const { client, authUrl } = useSession();
  const queryClient = useQueryClient();

  const openAuth = useCallback(
    (mode: AuthMode) => {
      const returnTo = currentPageUrl();
      const href = mode === "login" ? signInHref(authUrl, returnTo) : signUpHref(authUrl, returnTo);
      if (href) navigateTo(href);
    },
    [authUrl],
  );

  const logout = useCallback(async () => {
    await requestLogout(client);
    queryClient.removeQueries({ queryKey: sebookKeys.favorites });
    queryClient.removeQueries({ queryKey: sebookKeys.bookings });
    await queryClient.resetQueries({ queryKey: sebookKeys.me });
  }, [client, queryClient]);

  return useMemo(
    () => ({ user: me.data ?? null, isAuthenticated: me.data !== undefined, loading: me.isPending, openAuth, logout }),
    [me.data, me.isPending, openAuth, logout],
  );
}
