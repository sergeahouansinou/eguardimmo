import { describe, expect, it } from 'vitest';
import { OrgApiError } from '../../orgapi/errors';
import { EMPTY_FILTERS } from '../model';
import type { ActivityFilters } from '../model';
import { createApiActivitySource } from './source';
import * as api from './fixtures';
import { mockOrgApi, orgPath } from './testing';
import type { MockRoute } from './testing';
import { problem } from '../../orgapi/testing';

const url = (path = '') => orgPath(api.IDS.org, `/activity${path}`);
const query = { ...EMPTY_FILTERS, cursor: null };

function setup(routes: Record<string, MockRoute>) {
  const mock = mockOrgApi(routes);
  const source = createApiActivitySource({ client: mock.client, organizationId: api.IDS.org }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

async function failure(promise: Promise<unknown>): Promise<OrgApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OrgApiError) return error;
    throw error;
  }
  throw new Error('Une erreur était attendue.');
}

describe('source API du journal d’activité', () => {
  it('lit la liste, transmet filtres et curseur, et expose le curseur suivant', async () => {
    const { source, calls } = setup({ [`GET ${url()}`]: { body: api.page([api.row, api.rowSystem], 'suite') } });
    const filters: ActivityFilters = { from: '2026-03-01', to: '2026-04-01', actorId: api.IDS.member, type: 'paiement', subjectType: 'lease', subjectId: api.IDS.lease };

    const page = await source.list({ ...filters, cursor: 'abc' });

    expect(page.nextCursor).toBe('suite');
    expect(page.items[0]).toMatchObject({ id: api.IDS.entry, occurredAt: '2026-03-14T09:30:00+00:00', type: 'paiement', action: 'rent.payment.recorded', ip: '203.0.113.0/24', device: 'Chrome sur macOS', subject: { type: 'lease', id: api.IDS.lease } });
    expect(page.items[1]?.actor).toEqual({ kind: 'system', id: null, name: null, active: null });
    const search = calls[0]?.search;
    expect(Object.fromEntries(search?.entries() ?? [])).toEqual({
      from: '2026-03-01', to: '2026-04-01', actor: api.IDS.member, type: 'paiement', subject_type: 'lease', subject_id: api.IDS.lease, cursor: 'abc', per_page: '25',
    });
  });

  it('n’envoie aucun filtre vide et ne propose pas de page suivante sans has_more', async () => {
    const { source, calls } = setup({ [`GET ${url()}`]: { body: { data: [api.row], meta: { has_more: false, next_cursor: 'ignore' } } } });
    const page = await source.list(query);
    expect(page.nextCursor).toBeNull();
    expect([...(calls[0]?.search.keys() ?? [])]).toEqual(['per_page']);
  });

  it('lit la vue Historique d’un gestionnaire, sans action ni origine ni appareil', async () => {
    const { source } = setup({ [`GET ${url()}`]: { body: api.page([api.historyRow]) } });
    const page = await source.list({ ...query, subjectType: 'lease', subjectId: api.IDS.lease });
    expect(page.items[0]).toMatchObject({ label: 'Modification de bail', action: null, ip: null, device: null });
  });

  it('lit le détail : différentiel et informations complémentaires rendus en texte', async () => {
    const { source, calls } = setup({ [`GET ${url(`/${api.IDS.entry}`)}`]: { body: { data: api.detail } } });
    const detail = await source.detail(api.IDS.entry);

    expect(calls[0]?.path).toBe(url(`/${api.IDS.entry}`));
    expect(detail.reference).toBe('REQ-4242');
    expect(detail.changes).toEqual([
      { field: 'status', before: 'draft', after: 'sent' },
      { field: 'amount', before: '12000', after: 'vide' },
      { field: '<b>champ</b>', before: '<script>alert(1)</script>', after: '["a","b"]' },
    ]);
    expect(detail.metadata).toEqual([{ key: 'rows', value: '12' }, { key: 'from', value: '2026-01-01' }, { key: 'dry_run', value: 'non' }]);
  });

  it('accepte un détail sans différentiel ni informations', async () => {
    const { source } = setup({ [`GET ${url(`/${api.IDS.entryTwo}`)}`]: { body: { data: api.detailEmpty } } });
    const detail = await source.detail(api.IDS.entryTwo);
    expect(detail.changes).toEqual([]);
    expect(detail.metadata).toEqual([]);
  });

  it('exporte le CSV avec les mêmes filtres', async () => {
    const { source, calls } = setup({ [`GET ${url('/export')}`]: { csv: 'date;type\n' } });
    const blob = await source.exportCsv({ ...EMPTY_FILTERS, from: '2026-03-01', to: '2026-04-01', type: 'export' });

    expect(await blob.text()).toBe('date;type\n');
    expect(calls[0]?.search.get('from')).toBe('2026-03-01');
    expect(calls[0]?.search.get('type')).toBe('export');
    expect(calls[0]?.search.has('cursor')).toBe(false);
  });

  it('refuse sans appel réseau une période trop large, inversée ou un élément sans identifiant', async () => {
    const { source, calls } = setup({});
    expect((await failure(source.list({ ...query, from: '2025-01-01', to: '2026-01-03' }))).message).toBe('La période ne peut pas dépasser 366 jours.');
    expect((await failure(source.list({ ...query, from: '2026-03-02', to: '2026-03-02' }))).kind).toBe('invalid');
    expect((await failure(source.exportCsv({ ...EMPTY_FILTERS, subjectType: 'lease' }))).kind).toBe('invalid');
    expect(calls).toHaveLength(0);
  });

  it('accepte exactement 366 jours', async () => {
    const { source } = setup({ [`GET ${url()}`]: { body: api.page([]) } });
    await expect(source.list({ ...query, from: '2025-01-01', to: '2026-01-02' })).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('traduit 401, 403 et 404', async () => {
    const unauth = setup({ [`GET ${url()}`]: problem(401, 'unauthenticated') });
    expect((await failure(unauth.source.list(query))).kind).toBe('unauthenticated');

    const forbidden = setup({ [`GET ${url()}`]: problem(403, 'role_forbidden') });
    expect((await failure(forbidden.source.list(query))).kind).toBe('forbidden');

    const missing = setup({ [`GET ${url(`/${api.IDS.entry}`)}`]: problem(404, 'activity_not_found') });
    const notFound = await failure(missing.source.detail(api.IDS.entry));
    expect(notFound.kind).toBe('not_found');
    expect(notFound.message).toBe('Cette entrée n’existe pas dans le journal de votre organisation.');
  });

  it('traduit les refus de période et d’export trop volumineux (422)', async () => {
    const wide = setup({ [`GET ${url()}`]: problem(422, 'activity_range_too_wide') });
    expect((await failure(wide.source.list(query))).message).toBe('La période ne peut pas dépasser 366 jours.');

    const large = setup({ [`GET ${url('/export')}`]: problem(422, 'activity_export_too_large') });
    const error = await failure(large.source.exportCsv(EMPTY_FILTERS));
    expect(error.kind).toBe('invalid');
    expect(error.message).toContain('trop d’entrées');

    const invalid = setup({ [`GET ${url()}`]: { status: 422, body: { type: 'about:blank', title: 'x', status: 422, code: 'validation_failed', detail: 'd', errors: { subject_type: ['Le type est invalide.'] } } } });
    expect((await failure(invalid.source.list(query))).message).toBe('Le type est invalide.');
  });

  it('distingue la double authentification absente de la réauthentification à refaire', async () => {
    const reauth = setup({ [`GET ${url('/export')}`]: problem(403, 'reauthentication_required') });
    expect((await failure(reauth.source.exportCsv(EMPTY_FILTERS))).kind).toBe('reauthentication_required');

    const twoFactor = setup({ [`GET ${url('/export')}`]: problem(403, 'two_factor_required') });
    expect((await failure(twoFactor.source.exportCsv(EMPTY_FILTERS))).kind).toBe('two_factor_required');
  });

  it('explique la limite de 5 exports par heure avec le délai du serveur', async () => {
    const { source } = setup({ [`GET ${url('/export')}`]: { ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '1800' } } });
    const error = await failure(source.exportCsv(EMPTY_FILTERS));
    expect(error.kind).toBe('rate_limited');
    expect(error.message).toBe('Limite atteinte : 5 exports par heure au plus. Réessayez dans 30 minutes.');
  });

  it('traduit 429 sur la liste', async () => {
    const { source } = setup({ [`GET ${url()}`]: { ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '20' } } });
    const error = await failure(source.list(query));
    expect(error.kind).toBe('rate_limited');
    expect(error.message).toContain('dans 20 secondes');
  });

  it('rejette une réponse hors contrat plutôt que d’inventer des lignes', async () => {
    const { source } = setup({ [`GET ${url()}`]: { body: api.page([{ ...api.row, type: 'inconnu' }]) } });
    expect((await failure(source.list(query))).kind).toBe('unexpected_response');
  });

  it('refuse un export qui n’est pas du CSV', async () => {
    const { source } = setup({ [`GET ${url('/export')}`]: { file: { type: 'text/html', content: '<p>x</p>' } } });
    expect((await failure(source.exportCsv(EMPTY_FILTERS))).kind).toBe('unexpected_response');
  });

  it('exige une organisation sélectionnée', async () => {
    const mock = mockOrgApi({});
    const source = createApiActivitySource({ client: mock.client, organizationId: null }, { fetchImpl: mock.fetchImpl });
    expect((await failure(source.list(query))).kind).toBe('no_organization');
  });
});
