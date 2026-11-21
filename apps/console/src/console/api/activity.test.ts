import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleError, activityEntrySchema, activityListSchema } from '../schemas';
import { activityApi } from './activity';
import { requestUrl } from '../../../test/requestUrl';
import * as api from './fixtures';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function setup(...responses: Response[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    return next ? Promise.resolve(next) : Promise.reject(new TypeError('Aucune réponse prévue'));
  });
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl, readCookie: () => 'x' });
  const url = (index: number) => new URL(requestUrl(fetchImpl.mock.calls[index]?.[0] ?? ''));
  return { source: activityApi(client), fetchImpl, url };
}

describe('source API : journal d’activité', () => {
  it('liste par curseur en passant par l’origine de la console et mappe la ressource Laravel', async () => {
    const { source, url, fetchImpl } = setup(json(200, api.activityListResponse));
    const list = activityListSchema.parse(await source.list({ perPage: 25 }));

    expect(url(0).origin).toBe('https://console.test');
    expect(url(0).pathname).toBe('/api/v1/console/activity');
    expect(Object.fromEntries(url(0).searchParams)).toEqual({ per_page: '25' });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(list).toMatchObject({ perPage: 25, nextCursor: 'abc', prevCursor: null });
    expect(list.rows[0]).toEqual({
      id: api.IDS.entry,
      occurredAt: '2026-11-14T10:00:00.000300+00:00',
      action: 'user.updated',
      actor: { id: api.IDS.actor, name: 'Jeanne Dupont', email: 'jeanne@exemple.fr' },
      organizationId: api.IDS.org,
      subject: { type: 'user', id: api.IDS.subject },
      changes: [
        { field: 'name', before: 'Jeanne', after: '[masqué]' },
        { field: 'active', before: 'false', after: 'true' },
        { field: 'roles', before: '—', after: '["admin"]' },
      ],
      metadata: [
        { key: 'channel', value: 'web' },
        { key: 'attempts', value: '2' },
      ],
      requestId: api.IDS.request,
      route: 'identity.users.update',
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      redacted: false,
    });
  });

  it('accepte un auteur supprimé, un événement système, des métadonnées vides et aucun différentiel', async () => {
    const { source } = setup(json(200, api.activityListResponse));
    const second = activityListSchema.parse(await source.list({})).rows[1];

    expect(second).toMatchObject({ actor: { id: api.IDS.me, name: null, email: null }, subject: null, changes: [], metadata: [], ip: null });
  });

  it('marque comme masquée une entrée d’organisation sans accès, sans planter sur les champs null', async () => {
    const redacted = {
      ...api.activityEntry,
      actor: { id: api.IDS.actor, name: null, email: null },
      subject: { type: 'user', id: null },
      changes: null,
      metadata: null,
      ip: null,
      user_agent: null,
    };
    const { source } = setup(json(200, { ...api.activityListResponse, data: [redacted, ...api.activityListResponse.data] }));
    const [masked, open, system] = activityListSchema.parse(await source.list({})).rows;

    expect(masked).toMatchObject({ redacted: true, changes: [], metadata: [], ip: null, userAgent: null, subject: { type: 'user', id: null } });
    expect(open?.redacted).toBe(false);
    expect(system?.redacted).toBe(false);
  });

  it('ne masque pas une entrée sans organisation, même sans détail', async () => {
    const bare = { ...api.activityEntry, organization_id: null, changes: null, metadata: null, ip: null, user_agent: null, subject: { type: 'user', id: null }, actor: { id: api.IDS.actor, name: null, email: null } };
    const { source } = setup(json(200, { data: bare }));
    expect(activityEntrySchema.parse(await source.get(api.IDS.entry)).redacted).toBe(false);
  });

  it('envoie chaque filtre sous le nom de paramètre du backend, après nettoyage', async () => {
    const { source, url } = setup(json(200, api.activityListResponse));
    await source.list({
      action: ' lease. ',
      actor: api.IDS.actor,
      organization: api.IDS.org,
      requestId: api.IDS.request,
      subjectType: 'user',
      subjectId: api.IDS.subject,
      from: '2026-11-11',
      to: '2026-11-12',
      cursor: 'abc',
      perPage: 50,
    });

    expect(Object.fromEntries(url(0).searchParams)).toEqual({
      action: 'lease.',
      actor: api.IDS.actor,
      organization: api.IDS.org,
      request_id: api.IDS.request,
      subject_type: 'user',
      subject_id: api.IDS.subject,
      from: '2026-11-11T00:00:00Z',
      to: '2026-11-13T00:00:00Z',
      cursor: 'abc',
      per_page: '50',
    });
  });

  it('n’envoie aucun filtre vide', async () => {
    const { source, url } = setup(json(200, api.activityListResponse));
    await source.list({ action: '', actor: ' ', organization: '', from: '', to: '', cursor: '' });
    expect(url(0).search).toBe('');
  });

  it('ouvre une entrée avec son différentiel', async () => {
    const { source, url } = setup(json(200, api.activityDetailResponse));
    const entry = activityEntrySchema.parse(await source.get(api.IDS.entry));

    expect(url(0).pathname).toBe(`/api/v1/console/activity/${api.IDS.entry}`);
    expect(entry.changes).toHaveLength(3);
  });

  it('encode l’identifiant pour ne pas sortir du chemin', async () => {
    const { source, url } = setup(json(404, api.notFoundProblem));
    await expect(source.get('../me')).rejects.toBeInstanceOf(ConsoleError);
    expect(url(0).pathname).toBe('/api/v1/console/activity/..%2Fme');
  });

  it.each([
    [404, api.notFoundProblem, 'not_found'],
    [403, api.forbiddenProblem, 'forbidden'],
    [422, api.validationProblem, 'invalid'],
  ] as const)('traduit un %s en erreur de console avec le message du serveur', async (status, body, code) => {
    const { source } = setup(json(status, body));
    const error: unknown = await source.list({}).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ConsoleError);
    expect(error).toMatchObject({ code, message: status === 422 ? 'Curseur invalide.' : body.detail });
  });

  it('laisse passer un 429 avec son délai pour le message utilisateur', async () => {
    const { source } = setup(json(429, { code: 'too_many_requests', title: 'Trop de requêtes' }, { 'Retry-After': '30' }));
    await expect(source.list({})).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 });
  });

  it('refuse une réponse hors contrat sans exposer l’erreur Zod', async () => {
    const { source } = setup(json(200, { data: [{ id: 3 }], meta: {} }));
    await expect(source.list({})).rejects.toThrow('Réponse inattendue du serveur. Réessayez dans un instant.');
  });

  it('signale un serveur injoignable', async () => {
    const { source } = setup();
    await expect(source.list({})).rejects.toThrow('Le serveur est injoignable');
  });
});
