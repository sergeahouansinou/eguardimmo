import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationGate, useOrganizationSession } from './OrganizationGate';

const ORG = '01934f6e-0000-7000-8000-00000000000a';

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function Probe() {
  const session = useOrganizationSession();
  return <p>{`${session?.organization.name ?? 'aucune'} · ${session?.organization.role ?? ''}`}</p>;
}

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationGate apiUrl="https://api.test" authUrl="https://auth.test" kind="individual">
        <Probe />
      </OrganizationGate>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OrganizationGate', () => {
  it('ouvre l’espace de l’organisation du bon type et fournit la source Équipe', async () => {
    const fetchMock = stubFetch(() =>
      reply(200, {
        data: [
          { space: 'organization', label: 'Agence Delmas', meta: { organization: '01934f6e-0000-7000-8000-00000000000b', kind: 'agency', role: 'admin' } },
          { space: 'organization', label: 'Awa Diallo', meta: { organization: ORG, kind: 'individual', role: 'owner' } },
        ],
      }),
    );

    renderGate();

    await screen.findByText('Awa Diallo · owner');
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/me/profiles', expect.objectContaining({ credentials: 'include' }));
  });

  it('propose la connexion avec retour quand la session est absente', async () => {
    stubFetch(() => reply(401, { type: 'about:blank', title: 'Unauthenticated', status: 401, code: 'unauthenticated' }));

    renderGate();

    await screen.findByText('Connexion requise');
    const link = screen.getByRole('link', { name: 'Se connecter' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/auth\.test\/connexion\?return_to=/);
  });

  it('signale l’absence d’espace bailleur', async () => {
    stubFetch(() => reply(200, { data: [{ space: 'tenant', label: 'Locataire', meta: {} }] }));

    renderGate();

    await screen.findByText('Aucune organisation');
    expect(screen.queryByText(/Awa Diallo/)).toBeNull();
  });

  it('propose de réessayer quand le serveur est en erreur', async () => {
    stubFetch(() => reply(500, { type: 'about:blank', title: 'Erreur', status: 500, code: 'server_error' }));

    renderGate();

    await screen.findByText('Impossible d’ouvrir votre espace');
    screen.getByRole('button', { name: 'Réessayer' });
  });
});
