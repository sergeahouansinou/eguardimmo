import { ApiError, createApiClient } from '@eguardimmo/api';
import type { OrganizationSession } from '@eguardimmo/shell';
import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it, vi } from 'vitest';
import { createApiShellSource } from './shellSource';

const ORG = '01934f6e-0000-7000-8000-00000000000a';

const meResponse = {
  data: {
    id: '01934f6e-0000-7000-8000-0000000000a1',
    name: 'Jeanne Marie Dupont',
    email: 'jeanne.dupont@example.com',
    email_verified_at: '2026-11-01T09:00:00+00:00',
    last_login_at: '2026-11-16T08:30:00+00:00',
    previous_login_at: null,
  },
};

const organizationResponse = {
  data: { id: ORG, kind: 'individual', name: 'Dupont Gestion', country: 'FR', two_factor_required: false },
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sourceWith(routes: Record<string, Response>, role: OrganizationSession['organization']['role'] = 'owner') {
  const calls: string[] = [];
  const fetchImpl = vi.fn((url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    return Promise.resolve(routes[path] ?? reply(500, { type: 'about:blank', title: 'Route non prévue', status: 500, code: 'server_error' }));
  });
  const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: fetchImpl as unknown as typeof fetch, readCookie: () => 'xsrf' });
  const session = { organization: { organization: ORG, kind: 'individual', role, name: 'Dupont Gestion' } } as const;
  return { source: createApiShellSource(client, session), calls };
}

describe('coquille branchée sur /me et /org/{organization}', () => {
  it('compose utilisateur, organisation et rôle depuis les réponses du serveur', async () => {
    const { source, calls } = sourceWith({
      '/api/v1/me': reply(200, meResponse),
      [`/api/v1/org/${ORG}`]: reply(200, organizationResponse),
    });

    const shell = shellSchema.parse(await source.shell());

    expect(shell.user).toEqual({ firstName: 'Jeanne', fullName: 'Jeanne Marie Dupont', initials: 'JD', email: 'jeanne.dupont@example.com' });
    expect(shell.workspace).toEqual({ name: 'Dupont Gestion', role: 'owner' });
    expect(calls.sort()).toEqual(['/api/v1/me', `/api/v1/org/${ORG}`].sort());
  });

  it('ne fournit ni compteur, ni notification, ni formule, ni nombre de membres', async () => {
    const { source } = sourceWith({
      '/api/v1/me': reply(200, meResponse),
      [`/api/v1/org/${ORG}`]: reply(200, organizationResponse),
    });

    const shell = shellSchema.parse(await source.shell());

    expect(shell.counts).toEqual({});
    expect(shell.notifications).toEqual([]);
    expect(shell.workspace.plan).toBeUndefined();
    expect(shell.workspace.members).toBeUndefined();
    expect(shell.workspace.ownerName).toBeUndefined();
  });

  it('gère un nom d’un seul mot', async () => {
    const { source } = sourceWith({
      '/api/v1/me': reply(200, { data: { ...meResponse.data, name: 'Awa' } }),
      [`/api/v1/org/${ORG}`]: reply(200, organizationResponse),
    });

    expect((shellSchema.parse(await source.shell())).user).toMatchObject({ firstName: 'Awa', initials: 'A' });
  });

  it('transmet le rôle de la session (gestionnaire)', async () => {
    const { source } = sourceWith(
      { '/api/v1/me': reply(200, meResponse), [`/api/v1/org/${ORG}`]: reply(200, organizationResponse) },
      'manager',
    );

    expect(shellSchema.parse(await source.shell()).workspace.role).toBe('manager');
  });

  it('propage une panne du serveur au lieu d’inventer un compte', async () => {
    const { source } = sourceWith({
      '/api/v1/me': reply(401, { type: 'about:blank', title: 'Non authentifié', status: 401, code: 'unauthenticated' }),
      [`/api/v1/org/${ORG}`]: reply(200, organizationResponse),
    });

    await expect(source.shell()).rejects.toBeInstanceOf(ApiError);
  });

  it('refuse une réponse qui n’a pas la forme du serveur', async () => {
    const { source } = sourceWith({
      '/api/v1/me': reply(200, { data: { name: '', email: 'pas-un-email' } }),
      [`/api/v1/org/${ORG}`]: reply(200, organizationResponse),
    });

    await expect(source.shell()).rejects.toThrow();
  });

  it('ne simule ni lecture de notifications ni accueil', async () => {
    const { source, calls } = sourceWith({});

    await expect(source.markAllNotificationsRead()).rejects.toThrow('notifications');
    await expect(source.bureau()).rejects.toThrow('accueil');
    expect(source.markNotificationRead).toBeUndefined();
    expect(calls).toEqual([]);
  });
});
