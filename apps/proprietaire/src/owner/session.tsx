"use client";

import { createApiClient } from "@eguardimmo/api";
import type { ApiClient } from "@eguardimmo/api";
import { Alert, Button, Spinner } from "@eguardimmo/ui";
import { useQuery } from "@tanstack/react-query";
import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";
import { describeFailure, isNoAccess } from "./errors";
import { AGENCIES_STALE_MS, ownerKeys } from "./keys";
import { fetchAgencies } from "./requests";

export interface OwnerSession {
  client: ApiClient;
  authUrl: string | undefined;
}

const SessionContext = createContext<OwnerSession | null>(null);

export function useOwnerSession(): OwnerSession {
  const session = use(SessionContext);
  if (!session) throw new Error("OwnerGate manquant autour de l’espace propriétaire.");
  return session;
}

export function signInHref(authUrl: string | undefined): string | null {
  if (!authUrl || typeof window === "undefined") return null;
  const url = new URL("/connexion", authUrl);
  url.searchParams.set("return_to", window.location.href);
  return url.toString();
}

export function authLink(authUrl: string | undefined, path: string): string | null {
  return authUrl ? new URL(path, authUrl).toString() : null;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-3 p-4">{children}</div>;
}

export interface OwnerGateProps {
  apiUrl: string;
  authUrl: string | undefined;
  children: ReactNode;
}

export function OwnerGate({ apiUrl, authUrl, children }: OwnerGateProps) {
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl]);
  const query = useQuery({ queryKey: ownerKeys.agencies, queryFn: () => fetchAgencies(client), staleTime: AGENCIES_STALE_MS });
  const session = useMemo(() => ({ client, authUrl }), [client, authUrl]);

  if (query.isPending) {
    return (
      <Centered>
        <div className="flex justify-center">
          <Spinner size={32} label="Ouverture de votre espace" />
        </div>
      </Centered>
    );
  }

  if (query.isError && isNoAccess(query.error)) {
    const spaces = authLink(authUrl, "/profils");
    return (
      <Centered>
        <Alert tone="warning" title="Aucun accès propriétaire">
          <span className="flex flex-col items-start gap-2">
            Votre compte n’est rattaché à aucun mandat. L’accès propriétaire s’ouvre sur invitation de votre agence : ouvrez le lien reçu par e-mail
            et saisissez le code d’appariement qu’elle vous a remis, ou demandez-lui de vous inviter de nouveau.
            {spaces ? (
              <Button asChild variant="secondary" size="sm">
                <a href={spaces}>Choisir un autre espace</a>
              </Button>
            ) : null}
          </span>
        </Alert>
      </Centered>
    );
  }

  if (query.isError && query.data === undefined) {
    const failure = describeFailure(query.error);
    const href = failure.kind === "unauthenticated" ? signInHref(authUrl) : failure.kind === "unverified" ? authLink(authUrl, "/verification-email") : null;
    return (
      <Centered>
        <Alert tone="danger" title={failure.kind === "unauthenticated" ? "Connexion requise" : "Impossible d’ouvrir votre espace"}>
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {href ? (
              <Button asChild variant="link" size="sm">
                <a href={href}>{failure.kind === "unauthenticated" ? "Se connecter" : "Confirmer mon adresse"}</a>
              </Button>
            ) : (
              <Button variant="link" size="sm" onClick={() => void query.refetch()}>
                Réessayer
              </Button>
            )}
          </span>
        </Alert>
      </Centered>
    );
  }

  return <SessionContext value={session}>{children}</SessionContext>;
}
