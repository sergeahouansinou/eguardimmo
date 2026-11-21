import { ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { ReportingApiError } from './reportingErrors';
import { createApiReportingSource } from './reportingSource';
import * as api from './responses.fixtures';
import { mockReportingApi, orgPath } from './testing';
import type { MockRoute } from './testing';
import type { CreateReportsInput } from '../model';

const reporting = (path: string) => orgPath(api.IDS.org, `/reporting${path}`);
const plain = (path: string) => orgPath(api.IDS.org, path);
const KEY = 'ui-key-00000001';

function build(routes: Record<string, MockRoute>, role: 'owner' | 'admin' | 'manager' | 'accountant' | null = 'owner', kind: 'agency' | 'individual' | null = 'agency', cookie: string | null = 'xsrf') {
  const mock = mockReportingApi(routes);
  const source = createApiReportingSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { fetchImpl: mock.fetchImpl, readCookie: () => cookie });
  return { source, ...mock };
}

const input = (overrides: Partial<CreateReportsInput> = {}): CreateReportsInput => ({
  kind: 'monthly',
  start: '2026-10-01',
  end: '2026-10-31',
  mandantIds: [api.IDS.mandantA],
  sections: ['rent', 'fees'],
  options: { letterhead: true, reminderDetail: false, receiptsAttached: false },
  generate: true,
  notify: true,
  ...overrides,
});

describe('cartes', () => {
  it('charge la carte des loyers avec le mois demandé et renvoie les montants du serveur', async () => {
    const { source, callsTo } = build({ [`GET ${reporting('/home/agency-kpis')}`]: { body: api.agencyKpis } });
    const kpis = await source.agencyKpis('2026-11');
    expect(kpis).toMatchObject({ month: '2026-11', rentCalled: { amount: 70000, currency: 'EUR' }, rentCollected: { amount: 68000 }, collectionRateBp: 9714, feesNet: { amount: 4900 }, periodClosed: true });
    expect(callsTo('GET', reporting('/home/agency-kpis'))[0]?.search.get('month')).toBe('2026-11');
  });

  it('n’envoie aucun mois quand il n’est pas demandé et refuse un mois invalide', async () => {
    const { source, callsTo } = build({ [`GET ${reporting('/home/landlord')}`]: { body: api.landlord } });
    const home = await source.landlordHome();
    expect(home).toMatchObject({ vacantUnits: 1, leasesEnding: 2, openInterventions: 3, certificatesToRenew: 4 });
    expect(callsTo('GET', reporting('/home/landlord'))[0]?.search.has('month')).toBe(false);
    await expect(source.landlordHome('2026-13')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('charge les reversements, les alertes et l’ancienneté des impayés', async () => {
    const { source } = build({
      [`GET ${reporting('/home/agency-payouts')}`]: { body: api.payouts },
      [`GET ${reporting('/home/agency-alerts')}`]: { body: api.alerts },
      [`GET ${reporting('/finance/aging')}`]: { body: api.aging },
    });
    expect((await source.agencyPayouts()).topMandants[1]).toMatchObject({ partyId: api.IDS.mandantB, name: null, payable: { amount: 50000 } });
    expect((await source.agencyAlerts()).reportsDue).toMatchObject({ count: 2, mandantIds: [api.IDS.mandantA, api.IDS.mandantB] });
    const aging = await source.aging();
    expect(aging.total.amount).toBe(80000);
    expect(aging.buckets.map((bucket) => bucket.bucket)).toEqual(['0_30', '31_60', '61_90', 'over_90']);
  });

  it('refuse une réponse dont un montant n’est pas un entier', async () => {
    const broken = { data: { ...api.agencyKpis.data, rent_called: { amount: 700.5, currency: 'EUR' } } };
    const { source } = build({ [`GET ${reporting('/home/agency-kpis')}`]: { body: broken } });
    await expect(source.agencyKpis()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit le refus réservé aux agences', async () => {
    const { source } = build({ [`GET ${reporting('/home/agency-kpis')}`]: { status: 403, body: api.problem('reporting_agency_only', 'x') } });
    await expect(source.agencyKpis()).rejects.toMatchObject({ kind: 'forbidden', message: expect.stringContaining('réservés aux organisations de type agence') as unknown });
  });
});

describe('comptes rendus', () => {
  it('liste avec le curseur et les filtres, expose le curseur suivant et les mandants à générer', async () => {
    const { source, callsTo } = build({ [`GET ${reporting('/management-reports')}`]: { body: api.reportsPageFirst } });
    const page = await source.reports({ cursor: 'c1', status: 'draft', mandantId: api.IDS.mandantA });
    expect(page.nextCursor).toBe('curseur-2');
    expect(page.items[0]).toMatchObject({ id: api.IDS.reportGenerated, status: 'generated', totals: { collected: { amount: 70000 }, closingBalance: { amount: 0 } }, lines: null });
    const search = callsTo('GET', reporting('/management-reports'))[0]?.search;
    expect([search?.get('cursor'), search?.get('status'), search?.get('mandant'), search?.get('per_page')]).toEqual(['c1', 'draft', api.IDS.mandantA, '25']);
  });

  it('un brouillon n’a ni chiffre ni nom de mandant', async () => {
    const { source } = build({ [`GET ${reporting('/management-reports')}`]: { body: api.reportsPage } });
    const draft = (await source.reports({ cursor: null })).items[0];
    expect(draft?.mandantName).toBeNull();
    expect(draft?.totals.collected).toBeNull();
  });

  it('lit le détail avec ses lignes, lots et mandats', async () => {
    const { source } = build({ [`GET ${reporting(`/management-reports/${api.IDS.reportGenerated}`)}`]: { body: api.reportGeneratedDetail } });
    const report = await source.report(api.IDS.reportGenerated);
    expect(report.lines).toHaveLength(4);
    expect(report.lines?.[1]).toMatchObject({ kind: 'fee', amount: { amount: 4900 }, direction: 'debit' });
    expect(report.units[0]).toMatchObject({ reference: 'Apt 12', tenants: ['Jean Martin'] });
    expect(report.mandates[0]).toMatchObject({ reference: 'MG-2026-0001', feeBasisPoints: 700 });
  });

  it('accepte des options vides renvoyées sous forme de liste', async () => {
    const body = { data: { ...api.reportGenerated, options: [] } };
    const { source } = build({ [`GET ${reporting(`/management-reports/${api.IDS.reportGenerated}`)}`]: { body } });
    expect((await source.report(api.IDS.reportGenerated)).options).toEqual({ letterhead: true, reminderDetail: false, receiptsAttached: false });
  });

  it('liste les mandants par pages de 200 jusqu’à épuisement', async () => {
    const page = (start: number, count: number) => ({
      data: Array.from({ length: count }, (_, index) => ({ party_id: `01a1ee5a-0bb7-73fa-a273-ea6cbd9a${String(start + index).padStart(4, '0')}`, display_name: `Mandant ${String(start + index)}`, mandate_count: 1, running_mandate_count: 1 })),
    });
    let call = 0;
    const { source, callsTo } = build({ [`GET ${plain('/mandates/mandants')}`]: () => ({ body: page(call * 200, ++call === 1 ? 200 : 3) }) });
    expect(await source.mandants()).toHaveLength(203);
    const calls = callsTo('GET', plain('/mandates/mandants'));
    expect(calls).toHaveLength(2);
    expect(calls[1]?.search.get('after')).toBe('01a1ee5a-0bb7-73fa-a273-ea6cbd9a0199');
  });

  it('résout le nom d’un mandant et masque une partie anonymisée', async () => {
    const anonymous = { data: { id: api.IDS.mandantB, display_name: 'Supprimé', is_anonymized: true } };
    const { source } = build({ [`GET ${plain(`/parties/${api.IDS.mandantA}`)}`]: { body: api.partyA }, [`GET ${plain(`/parties/${api.IDS.mandantB}`)}`]: { body: anonymous } });
    expect(await source.partyName(api.IDS.mandantA)).toBe('Awa Diallo');
    expect(await source.partyName(api.IDS.mandantB)).toBeNull();
  });
});

describe('écritures', () => {
  it('crée par lot avec la clé d’idempotence, les sections et le mode demandés', async () => {
    const { source, callsTo } = build({ [`POST ${reporting('/management-reports')}`]: { status: 201, body: api.createdOne } });
    const results = await source.createReports(input(), KEY);
    expect(results[0]).toMatchObject({ outcome: 'created', report: { id: api.IDS.reportGenerated } });
    const call = callsTo('POST', reporting('/management-reports'))[0];
    expect(call?.headers.get('Idempotency-Key')).toBe(KEY);
    expect(call?.headers.get('X-XSRF-TOKEN')).toBe('xsrf');
    expect(call?.body).toEqual({
      period_kind: 'monthly',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      mandant_ids: [api.IDS.mandantA],
      sections: ['rent', 'fees'],
      options: { letterhead: true, reminder_detail: false, receipts_attached: false },
      mode: 'generate',
      notify: true,
    });
  });

  it('demande le mode brouillon sans génération', async () => {
    const { source, callsTo } = build({ [`POST ${reporting('/management-reports')}`]: { status: 201, body: api.createdOne } });
    await source.createReports(input({ generate: false }), KEY);
    expect((callsTo('POST', reporting('/management-reports'))[0]?.body as { mode: string }).mode).toBe('draft');
  });

  it('renvoie le détail par mandant d’un échec total malgré le statut d’erreur', async () => {
    const { source } = build({ [`POST ${reporting('/management-reports')}`]: { status: 409, body: api.createdAllFailed } });
    const results = await source.createReports(input(), KEY);
    expect(results[0]).toMatchObject({ outcome: 'failed', report: null, error: { code: 'report_period_overlap', status: 409 } });
  });

  it('un échec de création sans corps par mandant est une erreur traduite', async () => {
    const { source } = build({ [`POST ${reporting('/management-reports')}`]: { status: 422, body: api.problem('report_period_invalid', 'x') } });
    await expect(source.createReports(input(), KEY)).rejects.toMatchObject({ kind: 'invalid', code: 'report_period_invalid' });
  });

  it('une réponse 2xx sans liste par mandant est inattendue', async () => {
    const { source } = build({ [`POST ${reporting('/management-reports')}`]: { status: 201, body: { data: 'x' } } });
    await expect(source.createReports(input(), KEY)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('un serveur injoignable lève l’erreur réseau', async () => {
    const { source, fetchImpl } = build({});
    fetchImpl.mockRejectedValueOnce(new TypeError('réseau'));
    await expect(source.createReports(input(), KEY)).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  it('demande le cookie CSRF quand il manque', async () => {
    const mock = mockReportingApi({ [`POST ${reporting('/management-reports')}`]: { status: 201, body: api.createdOne }, 'GET /sanctum/csrf-cookie': { body: {} } });
    let reads = 0;
    const source = createApiReportingSource({ client: mock.client, organizationId: api.IDS.org, role: 'owner', kind: 'agency' }, { fetchImpl: mock.fetchImpl, readCookie: () => (reads++ === 0 ? null : 'jeton') });
    await source.createReports(input(), KEY);
    expect(mock.callsTo('GET', '/sanctum/csrf-cookie')).toHaveLength(1);
    expect(mock.callsTo('POST', reporting('/management-reports'))[0]?.headers.get('X-XSRF-TOKEN')).toBe('jeton');
  });

  it.each([
    ['une clé trop courte', () => input(), 'court'],
  ])('refuse %s', async (_label, make, key) => {
    const { source, fetchImpl } = build({});
    await expect(source.createReports(make(), key)).rejects.toMatchObject({ kind: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['aucun mandant', { mandantIds: [] }],
    ['plus de 50 mandants', { mandantIds: Array.from({ length: 51 }, (_, i) => `01a1ee5a-0bb7-73fa-a273-ea6cbd9b${String(i).padStart(4, '0')}`) }],
    ['aucune section', { sections: [] }],
    ['une fin avant le début', { start: '2026-10-31', end: '2026-10-01' }],
    ['une date invalide', { start: '2026-02-30' }],
  ] as const)('refuse localement : %s', async (_label, overrides) => {
    const { source, fetchImpl } = build({});
    await expect(source.createReports(input(overrides as Partial<CreateReportsInput>), KEY)).rejects.toBeInstanceOf(ReportingApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('modifie avec la version de verrou et les seuls champs changés', async () => {
    const { source, callsTo } = build({ [`PATCH ${reporting(`/management-reports/${api.IDS.reportGenerated}`)}`]: { body: api.reportGeneratedDetail } });
    await source.updateReport(api.IDS.reportGenerated, 3, { options: { letterhead: false }, notify: false });
    expect(callsTo('PATCH', reporting(`/management-reports/${api.IDS.reportGenerated}`))[0]?.body).toEqual({ lock_version: 3, options: { letterhead: false }, notify: false });
    await expect(source.updateReport(api.IDS.reportGenerated, 0, {})).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.updateReport(api.IDS.reportGenerated, 3, { sections: [] })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('un verrou périmé est une erreur de version', async () => {
    const { source } = build({ [`PATCH ${reporting(`/management-reports/${api.IDS.reportGenerated}`)}`]: { status: 409, body: api.problem('report_stale_version', 'x') } });
    await expect(source.updateReport(api.IDS.reportGenerated, 2, { notify: true })).rejects.toMatchObject({ kind: 'stale' });
  });

  it('génère, écarte, publie, planifie, annule la planification et rectifie', async () => {
    const id = api.IDS.reportGenerated;
    const { source, callsTo } = build({
      [`POST ${reporting(`/management-reports/${id}/generate`)}`]: { body: api.reportGeneratedDetail },
      [`POST ${reporting(`/management-reports/${id}/discard`)}`]: { body: api.reportDraftDetail },
      [`POST ${reporting(`/management-reports/${id}/publish`)}`]: { body: api.reportPublishedDetail },
      [`DELETE ${reporting(`/management-reports/${id}/schedule`)}`]: { body: api.reportGeneratedDetail },
      [`POST ${reporting(`/management-reports/${id}/rectify`)}`]: { status: 201, body: api.reportRectifiedDetail },
    });
    await source.generateReport(id);
    await source.discardReport(id);
    await source.publishReport(id);
    await source.scheduleReport(id, '2026-12-20T10:00:00+00:00');
    await source.unscheduleReport(id);
    const rectified = await source.rectifyReport(id, '  Loyer imputé au mauvais lot  ');
    expect(rectified.supersedesId).toBe(api.IDS.reportPublished);
    const publishes = callsTo('POST', reporting(`/management-reports/${id}/publish`));
    expect(publishes[0]?.body).toEqual({});
    expect(publishes[1]?.body).toEqual({ scheduled_for: '2026-12-20T10:00:00.000Z' });
    expect(callsTo('POST', reporting(`/management-reports/${id}/rectify`))[0]?.body).toEqual({ reason: 'Loyer imputé au mauvais lot' });
  });

  it.each(['court', 'x'.repeat(501)])('refuse localement un motif de rectification hors 10–500 caractères', async (reason) => {
    const { source, fetchImpl } = build({});
    await expect(source.rectifyReport(api.IDS.reportPublished, reason)).rejects.toMatchObject({ kind: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuse une date de planification illisible', async () => {
    const { source } = build({});
    await expect(source.scheduleReport(api.IDS.reportGenerated, 'demain')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('traduit le 503 du PDF avec le délai du serveur', async () => {
    const { source } = build({ [`POST ${reporting(`/management-reports/${api.IDS.reportGenerated}/publish`)}`]: { status: 503, body: api.problem('report_pdf_unavailable', 'x'), headers: { 'Retry-After': '30' } } });
    await expect(source.publishReport(api.IDS.reportGenerated)).rejects.toMatchObject({ kind: 'unavailable', message: expect.stringContaining('dans 30 secondes') as unknown });
  });
});

describe('fichiers et relevé', () => {
  it('télécharge le PDF et le CSV des lignes avec leur type', async () => {
    const id = api.IDS.reportGenerated;
    const { source } = build({
      [`GET ${reporting(`/management-reports/${id}/pdf`)}`]: { pdf: '%PDF-1.7' },
      [`GET ${reporting(`/management-reports/${id}/lines.csv`)}`]: { csv: 'date;type\n' },
    });
    expect((await source.pdf(id)).type).toContain('application/pdf');
    expect((await source.linesCsv(id)).type).toContain('text/csv');
  });

  it('refuse un fichier d’un autre type', async () => {
    const id = api.IDS.reportGenerated;
    const { source } = build({ [`GET ${reporting(`/management-reports/${id}/pdf`)}`]: { csv: 'x' } });
    await expect(source.pdf(id)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('l’export des lignes exige la double authentification', async () => {
    const id = api.IDS.reportGenerated;
    const { source } = build({ [`GET ${reporting(`/management-reports/${id}/lines.csv`)}`]: { status: 403, body: api.problem('two_factor_required', 'x') } });
    await expect(source.linesCsv(id)).rejects.toMatchObject({ kind: 'two_factor_required', message: expect.stringContaining('Connexion et sécurité') as unknown });
  });

  it('un PDF indisponible renvoie le message de reprise', async () => {
    const id = api.IDS.reportGenerated;
    const { source } = build({ [`GET ${reporting(`/management-reports/${id}/pdf`)}`]: { status: 503, body: api.problem('report_pdf_unavailable', 'x') } });
    await expect(source.pdf(id)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('lit le relevé en JSON et en CSV avec la période', async () => {
    const path = reporting(`/mandants/${api.IDS.mandantA}/statement`);
    const { source, callsTo } = build({ [`GET ${path}`]: (call) => (call.search.get('format') === 'csv' ? { csv: 'date;reference\n' } : { body: api.statement }) });
    const statement = await source.statement(api.IDS.mandantA, '2026-10-01', '2026-10-31');
    expect(statement).toMatchObject({ mandantName: 'Awa Diallo', openingBalance: { amount: 0 }, closingBalance: { amount: 5880 } });
    expect(statement.lines[1]).toMatchObject({ isReversal: true, debit: { amount: 64120 }, reference: null });
    expect((await source.statementCsv(api.IDS.mandantA, '2026-10-01', '2026-10-31')).type).toContain('text/csv');
    expect(callsTo('GET', path).map((call) => [call.search.get('from'), call.search.get('to'), call.search.get('format')])).toEqual([
      ['2026-10-01', '2026-10-31', 'json'],
      ['2026-10-01', '2026-10-31', 'csv'],
    ]);
  });

  it('refuse un relevé dont la fin précède le début, sans appel', async () => {
    const { source, fetchImpl } = build({});
    await expect(source.statement(api.IDS.mandantA, '2026-10-31', '2026-10-01')).rejects.toMatchObject({ kind: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('un relevé trop long est traduit', async () => {
    const path = reporting(`/mandants/${api.IDS.mandantA}/statement`);
    const { source } = build({ [`GET ${path}`]: { status: 422, body: api.problem('statement_too_long', 'x') } });
    await expect(source.statement(api.IDS.mandantA, '2020-01-01', '2026-10-31')).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining('réduisez la période') as unknown });
  });
});

describe('contexte', () => {
  it('sans organisation, aucune requête ne part', async () => {
    const mock = mockReportingApi({});
    const source = createApiReportingSource({ client: mock.client, organizationId: null, role: 'owner', kind: 'agency' }, { fetchImpl: mock.fetchImpl });
    await expect(source.aging()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(mock.fetchImpl).not.toHaveBeenCalled();
  });

  it('une session expirée est signalée', async () => {
    const { source } = build({ [`GET ${reporting('/finance/aging')}`]: { status: 401, body: api.problem('unauthenticated', 'x') } });
    await expect(source.aging()).rejects.toMatchObject({ kind: 'unauthenticated' });
  });

  it('un excès de requêtes est signalé avec le délai', async () => {
    const { source } = build({ [`GET ${reporting('/finance/aging')}`]: { status: 429, body: api.problem('x', 'x'), headers: { 'Retry-After': '120' } } });
    await expect(source.aging()).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringContaining('dans 2 minutes') as unknown });
  });
});

vi.setConfig({ testTimeout: 15000 });
