'use client';

import { createApiClient } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { Alert, Button, Spinner } from '@eguardimmo/ui';
import { useQuery } from '@tanstack/react-query';
import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import { describeFailure } from './errors';
import { tenantKeys } from './keys';
import { fetchTenantProfile } from './requests';

export interface TenantSession {
  client: ApiClient;
  authUrl: string | undefined;
}

const SessionContext = createContext<TenantSession | null>(null);

export function useTenantSession(): TenantSession {
  const session = use(SessionContext);
  if (!session) throw new Error('TenantGate manquant autour de l’espace locataire.');
  return session;
}

export function signInHref(authUrl: string | undefined): string | null {
  if (!authUrl || typeof window === 'undefined') return null;
  const url = new URL('/connexion', authUrl);
  url.searchParams.set('return_to', window.location.href);
  return url.toString();
}

function authLink(authUrl: string | undefined, path: string): string | null {
  return authUrl ? new URL(path, authUrl).toString() : null;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-3 p-4">{children}</div>;
}

export interface TenantGateProps {
  apiUrl: string;
  authUrl: string | undefined;
  children: ReactNode;
}

export function TenantGate({ apiUrl, authUrl, children }: TenantGateProps) {
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl]);
  const query = useQuery({
    queryKey: tenantKeys.session,
    queryFn: () => fetchTenantProfile(client),
    staleTime: Infinity,
  });
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

  if (query.isError) {
    const failure = describeFailure(query.error);
    const href = failure.kind === 'unauthenticated' ? signInHref(authUrl) : null;
    return (
      <Centered>
        <Alert tone="danger" title={failure.kind === 'unauthenticated' ? 'Connexion requise' : 'Impossible d’ouvrir votre espace'}>
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {href ? (
              <Button asChild variant="link" size="sm">
                <a href={href}>Se connecter</a>
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

  if (query.data === null) {
    const spaces = authLink(authUrl, '/profils');
    return (
      <Centered>
        <Alert tone="warning" title="Aucun accès locataire">
          <span className="flex flex-col items-start gap-2">
            Votre compte n’est rattaché à aucun bail. L’accès locataire s’ouvre sur invitation de votre agence ou de votre bailleur : ouvrez le
            lien reçu par e-mail, ou demandez-leur de vous inviter de nouveau.
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

  return <SessionContext value={session}>{children}</SessionContext>;
}
