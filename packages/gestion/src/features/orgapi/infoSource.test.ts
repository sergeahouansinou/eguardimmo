import { describe, expect, it } from 'vitest';
import { createApiOrgInfoSource } from './infoSource';
import { TEST_COLLEAGUE, TEST_ORG, TEST_USER, mockOrgApi, orgPath, problem } from './testing';
import type { MockRoute } from './testing';

const membersUrl = orgPath(TEST_ORG, '/members');
const PENDING_USER = '0198a0a0-0000-7000-8000-0000000000a9';

const memberRow = (overrides: Record<string, unknown>) => ({
  id: '0198a0a0-0000-7000-8000-0000000000e0',
  user_id: TEST_USER,
  first_name: 'Camille',
  last_name: 'Martin',
  email: 'camille.martin@example.test',
  role: 'owner',
  status: 'active',
  scope: { type: 'all', property_ids: [] },
  two_factor: 'enabled',
  last_login_at: '2026-03-20T08:00:00+01:00',
  invited_at: null,
  joined_at: '2026-01-05T09:00:00+01:00',
  message: null,
  self: true,
  ...overrides,
});

function setup(routes: Record<string, MockRoute>) {
  const mock = mockOrgApi(routes);
  const source = createApiOrgInfoSource({ client: mock.client, organizationId: TEST_ORG, role: 'owner', kind: 'agency' }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

describe('source API de l’organisation : membres', () => {
  it('propose chaque membre actif par son user_id, sans appeler /me', async () => {
    const { source, calls } = setup({
      [`GET ${membersUrl}`]: {
        body: {
          data: [
            memberRow({}),
            memberRow({ id: '0198a0a0-0000-7000-8000-0000000000e1', user_id: TEST_COLLEAGUE, first_name: 'Alex', last_name: 'Dupont', role: 'manager', self: false }),
          ],
        },
      },
    });

    const members = await source.members();

    expect(members).toEqual({
      choices: [
        { userId: TEST_USER, name: 'Camille Martin', self: true },
        { userId: TEST_COLLEAGUE, name: 'Alex Dupont', self: false },
      ],
      complete: true,
    });
    expect(calls.map((call) => call.path)).toEqual([membersUrl]);
  });

  it('écarte les membres invités ou désactivés dont user_id est nul', async () => {
    const { source } = setup({
      [`GET ${membersUrl}`]: {
        body: {
          data: [
            memberRow({}),
            memberRow({ id: '0198a0a0-0000-7000-8000-0000000000e2', user_id: null, first_name: 'Invité', last_name: 'En attente', status: 'invited', two_factor: 'pending', last_login_at: null, joined_at: null, self: false }),
            memberRow({ id: '0198a0a0-0000-7000-8000-0000000000e3', user_id: null, first_name: 'Ancien', last_name: 'Membre', status: 'disabled', self: false }),
          ],
        },
      },
    });

    const members = await source.members();

    expect(members.choices.map((choice) => choice.userId)).toEqual([TEST_USER]);
    expect(members.complete).toBe(true);
  });

  it('signale une liste incomplète quand un membre actif n’a pas d’identifiant', async () => {
    const { source } = setup({ [`GET ${membersUrl}`]: { body: { data: [memberRow({}), memberRow({ id: '0198a0a0-0000-7000-8000-0000000000e4', user_id: null, first_name: 'Sans', last_name: 'Compte', self: false })] } } });

    const members = await source.members();

    expect(members.choices).toHaveLength(1);
    expect(members.complete).toBe(false);
  });

  it('rejette une réponse où user_id est absent du contrat', async () => {
    const sansUserId = Object.fromEntries(Object.entries(memberRow({})).filter(([key]) => key !== 'user_id'));
    const { source } = setup({ [`GET ${membersUrl}`]: { body: { data: [sansUserId] } } });

    await expect(source.members()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('rejette un user_id qui n’est pas un UUID', async () => {
    const { source } = setup({ [`GET ${membersUrl}`]: { body: { data: [memberRow({ user_id: PENDING_USER.slice(0, 10) })] } } });

    await expect(source.members()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit un refus du serveur', async () => {
    const { source } = setup({ [`GET ${membersUrl}`]: problem(403, 'role_forbidden') });

    await expect(source.members()).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
