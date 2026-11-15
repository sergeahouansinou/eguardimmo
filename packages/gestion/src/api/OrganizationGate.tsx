'use client';

import { ApiError, createApiClient, findOrganization } from '@eguardimmo/api';
import type { ApiClient, OrganizationProfile } from '@eguardimmo/api';
import { Alert, Button } from '@eguardimmo/ui';
import { useQuery } from '@tanstack/react-query';
import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import { LoadingBlock } from '../features/outils/kit';
import { EquipeSourceProvider, createApiEquipeSource } from '../features/compte';

export interface OrganizationSession {
  client: ApiClient;
  organization: OrganizationProfile;
}

const SessionContext = createContext<OrganizationSession | null>(null);

export function useOrganizationSession(): OrganizationSession | null {
  return use(SessionContext);
}

export interface OrganizationGateProps {
  apiUrl: string;
  authUrl: string | undefined;
  kind: OrganizationProfile['kind'];
  children: ReactNode;
}

function signInHref(authUrl: string | undefined): string | null {
  if (!authUrl || typeof window === 'undefined') return null;
  const url = new URL('/connexion', authUrl);
  url.searchParams.set('return_to', window.location.href);
  return url.toString();
}

export function OrganizationGate({ apiUrl, authUrl, kind, children }: OrganizationGateProps) {
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl]);
  const query = useQuery({ queryKey: ['api', 'organization', kind], queryFn: () => findOrganization(client, kind), retry: false, staleTime: Infinity });
  const equipe = useMemo(() => (query.data ? createApiEquipeSource(client, query.data.organization) : null), [client, query.data]);

  if (query.isPending) {
    return (
      <div className="p-4">
        <LoadingBlock label="Ouverture de votre espace" />
      </div>
    );
  }

  if (query.isError) {
    const unauthenticated = query.error instanceof ApiError && query.error.status === 401;
    const href = unauthenticated ? signInHref(authUrl) : null;
    return (
      <div className="p-4">
        <Alert tone="danger" title={unauthenticated ? 'Connexion requise' : 'Impossible d’ouvrir votre espace'}>
          <span className="flex flex-wrap items-center gap-2">
            {unauthenticated ? 'Connectez-vous pour accéder à votre espace.' : query.error.message}
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
      </div>
    );
  }

  if (query.data === null || equipe === null) {
    return (
      <div className="p-4">
        <Alert tone="warning" title="Aucune organisation">
          {kind === 'agency'
            ? 'Votre compte n’est membre d’aucune agence. Demandez une invitation au titulaire du compte de votre agence.'
            : 'Votre compte n’a pas encore d’espace bailleur. Créez-le depuis votre profil.'}
        </Alert>
      </div>
    );
  }

  return (
    <SessionContext value={{ client, organization: query.data }}>
      <EquipeSourceProvider source={equipe}>{children}</EquipeSourceProvider>
    </SessionContext>
  );
}
