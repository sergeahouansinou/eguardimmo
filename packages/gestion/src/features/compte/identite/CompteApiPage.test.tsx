import { OrganizationGate } from '@eguardimmo/shell';
import { ACCOUNT_IDS, devicesAfterRevocation, devicesResponse, meResponse, securityResponse } from '@eguardimmo/shell/account/fixtures';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { CompteApiPage, SecuriteApiPage } from './CompteApiPage';

const PROFILES = {
  data: [{ space: 'organization', label: 'Agence Les Tilleuls', meta: { organization: ACCOUNT_IDS.organization, kind: 'agency', role: 'owner' } }],
};

interface Reply {
  status?: number;
  body?: unknown;
}

function stubFetch(routes: Record<string, () => Reply>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const key = `${init?.method ?? 'GET'} ${url.pathname}`;
      calls.push(key);
      if (url.pathname === '/sanctum/csrf-cookie') return Promise.resolve(new Response(null, { status: 204 }));
      const handler: (() => Reply) | undefined = key === 'GET /api/v1/me/profiles' ? () => ({ body: PROFILES }) : routes[key];
      if (handler === undefined) return Promise.reject(new Error(`Appel réseau inattendu : ${key}`));
      const { status = 200, body } = handler();
      return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } }));
    }),
  );
  return calls;
}

function renderInGate(page: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={client}>
        <OrganizationGate apiUrl="http://api.test" authUrl="http://localhost:3040" kind="agency">
          {page}
        </OrganizationGate>
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mon compte des espaces agence et bailleur en mode API', () => {
  it('lit l’identité sur /me avec le client de la session de l’organisation', async () => {
    const calls = stubFetch({ 'GET /api/v1/me': () => ({ body: meResponse }) });

    const { container } = renderInGate(<CompteApiPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mon compte' })).toBeTruthy();
    expect(await screen.findByText('Jeanne Martin')).toBeTruthy();
    expect(screen.getByText('jeanne@exemple.fr')).toBeTruthy();
    expect(await screen.findAllByText('Agence Les Tilleuls')).not.toHaveLength(0);
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('refuse d’afficher le compte hors de la session de l’organisation', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();

    expect(() => render(<QueryClientProvider client={client}><CompteApiPage /></QueryClientProvider>)).toThrow('OrganizationGate manquant');
    error.mockRestore();
  });
});

describe('Connexion et sécurité des espaces agence et bailleur en mode API', () => {
  it('affiche l’état de sécurité, les appareils et révoque l’appareil confirmé', async () => {
    let revoked = false;
    const calls = stubFetch({
      'GET /api/v1/me/security': () => ({ body: securityResponse }),
      'GET /api/v1/me/devices': () => ({ body: revoked ? devicesAfterRevocation : devicesResponse }),
      [`DELETE /api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`]: () => {
        revoked = true;
        return { status: 204 };
      },
    });

    const { container, user } = renderInGate(<SecuriteApiPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion et sécurité' })).toBeTruthy();
    expect(await screen.findByText('Non activée')).toBeTruthy();
    expect(await screen.findByText('Pixel 9')).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: 'Révoquer Pixel 9' }));
    const dialog = await screen.findByRole('dialog', { name: 'Révoquer Pixel 9 ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Révoquer l’appareil' }));

    expect(await screen.findByText('« Pixel 9 » a été déconnecté.')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByRole('button', { name: /Révoquer/ })).toBeNull(); });
    expect(calls.filter((call) => call.startsWith('DELETE'))).toEqual([`DELETE /api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`]);
    expect(screen.getByRole('link', { name: /Supprimer mon compte/ }).getAttribute('href')).toBe('http://localhost:3040/compte/supprimer');
  });
});
