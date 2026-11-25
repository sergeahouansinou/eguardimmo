"use client";

import { createApiClient } from "@eguardimmo/api";
import type { ApiClient } from "@eguardimmo/api";
import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

export interface Session {
  client: ApiClient;
  authUrl: string | undefined;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ apiUrl, authUrl, children }: { apiUrl: string; authUrl: string | undefined; children: ReactNode }) {
  const session = useMemo<Session>(() => ({ client: createApiClient({ baseUrl: apiUrl }), authUrl }), [apiUrl, authUrl]);
  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error("SessionProvider manquant autour de SeBook.");
  return session;
}
