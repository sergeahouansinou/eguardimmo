import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError, describeProblem } from '../errors';
import { IDS, approvalData, approvalList } from '../fixtures';
import { ERROR_CASES, jsonResponse, setupApi } from '../testApi';
import { approvalsApi } from './approvals';

describe('API des approbations', () => {
  it('liste avec les filtres en 1/0, le curseur et le compteur du serveur', async () => {
    const { client, url } = setupApi(jsonResponse(200, approvalList([approvalData()], { has_more: true, next_cursor: 'abc', pending_count: 4 })));
    const page = await approvalsApi(client).list({ status: 'pending', action: ' organizations.suspend ', mine: true, cursor: 'xyz', perPage: 20 });

    expect(url().pathname).toBe('/api/v1/console/approvals');
    expect(Object.fromEntries(url().searchParams)).toEqual({ status: 'pending', action: 'organizations.suspend', mine: '1', cursor: 'xyz', per_page: '20' });
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'abc', pendingCount: 4 });
    expect(page.rows[0]).toMatchObject({
      id: IDS.approval,
      action: 'organizations.suspend',
      subjectType: 'organization',
      subjectId: IDS.org,
      status: 'pending',
      ticketReference: 'SUP-2026-00042',
      payload: [{ key: 'reason_code', value: 'fraud' }],
      requestedBy: { id: IDS.second, name: 'Jean Moreau' },
      canDecide: true,
      canCancel: false,
    });
  });

  it('n’envoie aucun filtre vide et lit « mine » à 0', async () => {
    const { client, url } = setupApi(jsonResponse(200, approvalList([])), jsonResponse(200, approvalList([])));
    await approvalsApi(client).list();
    await approvalsApi(client).list({ mine: false, action: '  ' });

    expect(Object.fromEntries(url(0).searchParams)).toEqual({});
    expect(Object.fromEntries(url(1).searchParams)).toEqual({ mine: '0' });
  });

  it('lit une charge utile vide sérialisée en liste par PHP, ou absente', async () => {
    const { client } = setupApi(jsonResponse(200, approvalList([approvalData({ payload: [] }), approvalData({ payload: null }), approvalData({ payload: { count: 3, urgent: true, nested: { a: 1 } } })])));
    const page = await approvalsApi(client).list();

    expect(page.rows[0]?.payload).toEqual([]);
    expect(page.rows[1]?.payload).toEqual([]);
    expect(page.rows[2]?.payload).toEqual([
      { key: 'count', value: '3' },
      { key: 'urgent', value: 'true' },
      { key: 'nested', value: '{"a":1}' },
    ]);
  });

  it('reprend les permissions du serveur sans les déduire du statut', async () => {
    const { client } = setupApi(jsonResponse(200, { data: approvalData({ status: 'pending', permissions: { can_decide: false, can_cancel: true }, requested_by: { id: IDS.me, name: 'Awa Diallo' } }) }));
    const approval = await approvalsApi(client).get(IDS.approval);

    expect(approval).toMatchObject({ status: 'pending', canDecide: false, canCancel: true, requestedBy: { id: IDS.me } });
  });

  it('lit une demande décidée avec son décideur et son exécution', async () => {
    const { client, url } = setupApi(
      jsonResponse(200, {
        data: approvalData({
          status: 'approved',
          decided_by: { id: IDS.me, name: 'Awa Diallo' },
          decided_proof: 'totp',
          decided_at: '2026-11-21T11:00:00+00:00',
          executed_at: '2026-11-21T11:00:01+00:00',
          permissions: { can_decide: false, can_cancel: false },
        }),
      }),
    );
    const approval = await approvalsApi(client).get(IDS.approval);

    expect(url().pathname).toBe(`/api/v1/console/approvals/${IDS.approval}`);
    expect(approval).toMatchObject({ status: 'approved', decidedBy: { id: IDS.me, name: 'Awa Diallo' }, decidedAt: '2026-11-21T11:00:00+00:00', executedAt: '2026-11-21T11:00:01+00:00', canDecide: false });
  });

  it('dépose une demande avec le sujet, le motif, le ticket et la charge utile en chaînes', async () => {
    const { client, url, body, method } = setupApi(jsonResponse(201, { data: approvalData() }));
    await approvalsApi(client).request({ action: 'organizations.suspend', subjectId: IDS.org, reason: 'Fraude documentaire.', ticketReference: ' SUP-1 ', payload: { reason_code: 'fraud' } });

    expect(method()).toBe('POST');
    expect(url().pathname).toBe('/api/v1/console/approvals');
    expect(body()).toEqual({ action: 'organizations.suspend', subject_id: IDS.org, reason: 'Fraude documentaire.', ticket_reference: 'SUP-1', payload: { reason_code: 'fraud' } });
  });

  it('omet le ticket et la charge utile quand ils sont vides', async () => {
    const { client, body } = setupApi(jsonResponse(201, { data: approvalData() }));
    await approvalsApi(client).request({ action: 'organizations.reactivate', subjectId: IDS.org, reason: 'Régularisé.', ticketReference: '  ', payload: {} });

    expect(body()).toEqual({ action: 'organizations.reactivate', subject_id: IDS.org, reason: 'Régularisé.' });
  });

  it.each(['approve', 'reject', 'cancel'] as const)('envoie « %s » sans corps sur la bonne ressource', async (verb) => {
    const { client, url, body, method } = setupApi(jsonResponse(200, { data: approvalData({ status: 'approved' }) }));
    await approvalsApi(client)[verb](IDS.approval);

    expect(method()).toBe('POST');
    expect(url().pathname).toBe(`/api/v1/console/approvals/${IDS.approval}/${verb}`);
    expect(body()).toBeNull();
  });

  it('encode l’identifiant dans le chemin', async () => {
    const { client, url } = setupApi(jsonResponse(200, { data: approvalData() }));
    await approvalsApi(client).get('a/b?c');

    expect(url().pathname).toBe('/api/v1/console/approvals/a%2Fb%3Fc');
  });

  describe.each([
    ['liste', (api: ReturnType<typeof approvalsApi>) => api.list()],
    ['détail', (api: ReturnType<typeof approvalsApi>) => api.get(IDS.approval)],
    ['validation', (api: ReturnType<typeof approvalsApi>) => api.approve(IDS.approval)],
    ['refus', (api: ReturnType<typeof approvalsApi>) => api.reject(IDS.approval)],
    ['annulation', (api: ReturnType<typeof approvalsApi>) => api.cancel(IDS.approval)],
    ['dépôt', (api: ReturnType<typeof approvalsApi>) => api.request({ action: 'organizations.suspend', subjectId: IDS.org, reason: 'x' })],
  ])('erreurs de %s', (_name, call) => {
    it.each(ERROR_CASES)('classe %i comme %s', async (status, payload, kind, code) => {
      const { client } = setupApi(jsonResponse(status, payload, status === 429 ? { 'Retry-After': '12' } : {}));
      const error: unknown = await call(approvalsApi(client)).catch((caught: unknown) => caught);

      expect(describeProblem(error)).toMatchObject({ kind, code });
    });
  });

  it('indique le délai d’attente d’un 429', async () => {
    const { client } = setupApi(jsonResponse(429, ERROR_CASES[5][1], { 'Retry-After': '12' }));
    const error: unknown = await approvalsApi(client).list().catch((caught: unknown) => caught);

    expect(describeProblem(error)).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 12 });
    expect(describeProblem(error).message).toContain('12 s');
  });

  it('refuse une réponse sans permissions, un statut inconnu et une liste sans compteur', async () => {
    const withoutPermissions = approvalData();
    Reflect.deleteProperty(withoutPermissions, 'permissions');
    await expect(approvalsApi(setupApi(jsonResponse(200, { data: withoutPermissions })).client).get(IDS.approval)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(approvalsApi(setupApi(jsonResponse(200, { data: approvalData({ status: 'archived' }) })).client).get(IDS.approval)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(approvalsApi(setupApi(jsonResponse(200, { data: [approvalData()], meta: { has_more: false, next_cursor: null } })).client).list()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});
