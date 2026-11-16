import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { BAUX_FEATURES } from '../capabilities';
import { exitSchema, leaseSchema } from '../schemas';
import { BauxApiError, LeaseStaleVersionError } from './apiErrors';
import { createApiBauxSource } from './apiSource';
import * as api from './responses.fixtures';
import { mockApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const NOW = new Date('2026-11-16T10:00:00Z');
const org = (path: string) => orgPath(api.IDS.org, path);
const lease = (id: string) => org(`/leases/${id}`);

function setup(routes: Record<string, MockRoute>, organizationId: string | null = api.IDS.org) {
  const mock = mockApi(routes);
  const source = createApiBauxSource({ client: mock.client, organizationId }, { now: () => NOW });
  return { source, ...mock };
}

const listRoutes = (): Record<string, MockRoute> => ({
  [`GET ${org('/leases')}`]: (call) => {
    if (call.search.get('archived') === '1') return { body: api.pageOf([api.archivedDetail]) };
    return call.search.get('cursor') === 'page2' ? { body: api.pageOf([api.noticeDetail]) } : { body: api.pageOf([api.leaseDetail], 'page2') };
  },
  [`GET ${lease(api.IDS.lease)}`]: { body: api.detailResponse(api.leaseDetail) },
  [`GET ${lease(api.IDS.leaseNotice)}`]: { body: api.detailResponse(api.noticeDetail) },
  [`GET ${lease(api.IDS.leaseArchived)}`]: { body: api.detailResponse(api.archivedDetail) },
});

describe('lecture', () => {
  it('charge toutes les pages par curseur, les archivés et le détail de chaque bail', async () => {
    const { source, callsTo, calls } = setup(listRoutes());
    const leases = (await source.leases()) as unknown[];

    expect(leases.map((entry) => leaseSchema.parse(entry).reference)).toEqual(['BL-2026-0001', 'BL-2026-0002', 'BL-2025-0009']);
    const listing = callsTo('GET', org('/leases'));
    expect(listing.map((call) => Object.fromEntries(call.search))).toEqual([
      { per_page: '100' },
      { per_page: '100', archived: '1' },
      { per_page: '100', cursor: 'page2' },
    ]);
    expect(calls.filter((call) => call.path.startsWith(org('/leases/')))).toHaveLength(3);
    expect(leaseSchema.parse(leases[2]).archived).toBe(true);
  });

  it('mutualise deux lectures simultanées de la liste', async () => {
    const { source, callsTo } = setup(listRoutes());
    await Promise.all([source.leases(), source.exits()]);
    expect(callsTo('GET', org('/leases'))).toHaveLength(3);
  });

  it('déduit les sorties des préavis enregistrés, sans données d’exemple', async () => {
    const { source } = setup(listRoutes());
    const exits = (await source.exits()) as unknown[];
    expect(exits).toHaveLength(1);
    expect(exitSchema.parse(exits[0])).toMatchObject({ leaseId: api.IDS.leaseNotice, departure: '2026-11-30', steps: [] });
  });

  it('pagine une page à la fois avec filtres de phase, lot, partie, recherche et archivage', async () => {
    const { source, callsTo } = setup({ ...listRoutes(), [`GET ${org('/leases')}`]: { body: api.pageOf([api.leaseDetail], 'suite') } });
    const page = await source.leasePage({ status: 'preavis', unitId: api.IDS.unit, partyId: api.IDS.tenant, search: 'BL-2026', archived: true, cursor: 'abc', perPage: 20 });

    expect(Object.fromEntries(callsTo('GET', org('/leases'))[0]?.search ?? [])).toEqual({
      per_page: '20',
      cursor: 'abc',
      phase: 'notice',
      unit: api.IDS.unit,
      party: api.IDS.tenant,
      archived: '1',
      q: 'BL-2026',
    });
    expect(page.nextCursor).toBe('suite');
    expect(page.items.map((item) => item.reference)).toEqual(['BL-2026-0001']);
  });

  it('lit un bail et refuse une réponse qui ne respecte pas le contrat', async () => {
    const { source } = setup({ [`GET ${lease(api.IDS.lease)}`]: { body: { data: { ...api.leaseDetail, phase: 'inconnue' } } } });
    await expect(source.lease(api.IDS.lease)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('lit les régimes et l’occupation des lots', async () => {
    const { source, callsTo } = setup({
      [`GET ${org('/leases/regimes')}`]: { body: api.regimesResponse },
      [`GET ${org('/leases/occupancy')}`]: { body: api.occupancyResponse },
    });
    expect((await source.regimes(api.IDS.unit)).map((regime) => regime.key)).toEqual(['fr.residential.furnished', 'fr.residential.unfurnished']);
    const occupancy = await source.occupancy([api.IDS.unit, api.IDS.annex], '2026-11-16');
    expect(occupancy.map((entry) => entry.vacant)).toEqual([false, true]);
    expect(callsTo('GET', org('/leases/regimes'))[0]?.search.get('unit')).toBe(api.IDS.unit);
    expect(Object.fromEntries(callsTo('GET', org('/leases/occupancy'))[0]?.search ?? [])).toEqual({ 'units[0]': api.IDS.unit, 'units[1]': api.IDS.annex, date: '2026-11-16' });
  });
});

describe('création', () => {
  const routes = (): Record<string, MockRoute> => ({
    [`GET ${org('/leases/regimes')}`]: { body: api.regimesResponse },
    [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse },
    [`POST ${org('/leases')}`]: { status: 201, body: api.detailResponse(api.draftDetail) },
    [`POST ${lease(api.IDS.leaseDraft)}/sign`]: { body: api.detailResponse({ ...api.draftDetail, status: 'signed', phase: 'running', lock_version: 2, signed_on: '2026-11-16' }) },
  });
  const form = (overrides: Record<string, unknown> = {}) => ({
    unitId: api.IDS.unit,
    furnished: false,
    start: '2026-12-01',
    durationMonths: '36',
    tenantIds: [api.IDS.tenant],
    paymentMethod: 'virement',
    note: '',
    rent: '850',
    charges: '60',
    deposit: '850',
    dueDay: '5',
    asDraft: false,
    ...overrides,
  });

  it('enregistre le brouillon sans le signer', async () => {
    const { source, callsTo } = setup(routes());
    const created = leaseSchema.parse(await source.createLease(form({ asDraft: true })));

    expect(created).toMatchObject({ reference: 'BL-2026-0003', status: 'brouillon' });
    const body = callsTo('POST', org('/leases'))[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ regime_key: 'fr.residential.unfurnished', jurisdiction: 'FR', starts_on: '2026-12-01', billing_timing: 'advance' });
    expect(callsTo('POST', `${lease(api.IDS.leaseDraft)}/sign`)).toHaveLength(0);
  });

  it('émet le bail en le signant avec la version reçue à la création', async () => {
    const { source, callsTo } = setup(routes());
    const created = leaseSchema.parse(await source.createLease(form()));

    expect(created.status).toBe('en_cours');
    expect(callsTo('POST', `${lease(api.IDS.leaseDraft)}/sign`)[0]?.body).toEqual({ lock_version: 1, signed_on: '2026-11-16' });
  });

  it('choisit le régime meublé pour une location meublée', async () => {
    const { source, callsTo } = setup(routes());
    await source.createLease(form({ furnished: true, asDraft: true, deposit: '1000' }));
    expect((callsTo('POST', org('/leases'))[0]?.body as Record<string, unknown>).regime_key).toBe('fr.residential.furnished');
  });

  it('refuse un bien ou un locataire de démonstration sans appeler le serveur', async () => {
    const { source, calls } = setup(routes());
    await expect(source.createLease(form({ unitId: 'studio-2e' }))).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('signale un bail resté en brouillon quand l’émission est refusée', async () => {
    const { source } = setup({
      ...routes(),
      [`POST ${lease(api.IDS.leaseDraft)}/sign`]: { status: 422, body: api.problem(422, 'lease_no_rent', 'Loyer manquant', 'Ajoutez une ligne de loyer en vigueur à la date de début du bail avant de continuer.') },
    });
    const failure = await source.createLease(form()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BauxApiError);
    expect((failure as BauxApiError).message).toBe('Le bail BL-2026-0003 est enregistré en brouillon mais n’a pas pu être émis : Ajoutez une ligne de loyer en vigueur à la date de début du bail avant de continuer.');
  });

  it('refuse un pays sans régime ouvert', async () => {
    const { source } = setup({ ...routes(), [`GET ${org('/leases/regimes')}`]: { body: { data: [] } } });
    await expect(source.createLease(form({ asDraft: true }))).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('signale un référentiel de composantes incomplet', async () => {
    const { source } = setup({ ...routes(), [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: { data: api.catalogTermsResponse.data.slice(0, 2) } } });
    await expect(source.createLease(form({ asDraft: true }))).rejects.toMatchObject({ code: 'component_missing' });
  });
});

describe('modification et version', () => {
  const patchPath = lease(api.IDS.lease);

  it('envoie la version lue dans la liste, sans relire le bail', async () => {
    const { source, callsTo } = setup({ ...listRoutes(), [`PATCH ${patchPath}`]: { body: api.detailResponse({ ...api.leaseDetail, lock_version: 4, note: 'Autre' }) } });
    await source.leases();
    const before = callsTo('GET', patchPath).length;

    await source.updateLease(api.IDS.lease, { unitId: api.IDS.unit, furnished: false, start: '2026-01-01', durationMonths: '36', tenantIds: [api.IDS.tenant], paymentMethod: 'cheque', note: 'Autre', rent: '850', charges: '60', deposit: '850', dueDay: '5', asDraft: false });

    expect(callsTo('GET', patchPath)).toHaveLength(before);
    expect(callsTo('PATCH', patchPath)[0]?.body).toEqual({ lock_version: 3, payment_method: 'cheque', note: 'Autre' });
  });

  it('transforme le 409 lease_stale_version en erreur typée affichable', async () => {
    const { source } = setup({ ...listRoutes(), [`PATCH ${patchPath}`]: { status: 409, body: api.staleProblem } });
    await source.leases();
    const failure = await source
      .updateLease(api.IDS.lease, { unitId: api.IDS.unit, furnished: false, start: '2026-01-01', durationMonths: '36', tenantIds: [api.IDS.tenant], paymentMethod: 'virement', note: 'x', rent: '850', charges: '60', deposit: '850', dueDay: '5', asDraft: false })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LeaseStaleVersionError);
    expect((failure as Error).message).toBe('Ce bail a été modifié entre-temps. Rechargez la page pour voir sa dernière version, puis refaites vos changements.');
  });

  it('refuse localement de changer les conditions d’un bail signé', async () => {
    const { source, callsTo } = setup({ [`GET ${patchPath}`]: { body: api.detailResponse(api.leaseDetail) } });
    const failure = await source
      .updateLease(api.IDS.lease, { unitId: api.IDS.unit, furnished: false, start: '2026-01-01', durationMonths: '36', tenantIds: [api.IDS.tenant], paymentMethod: 'virement', note: '', rent: '900', charges: '60', deposit: '850', dueDay: '5', asDraft: false })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ kind: 'conflict', code: 'lease_not_draft' });
    expect(callsTo('PATCH', patchPath)).toHaveLength(0);
  });

  it('met à jour un brouillon en conservant garant et lots rattachés', async () => {
    const draftPath = lease(api.IDS.leaseDraft);
    const { source, callsTo } = setup({
      [`GET ${draftPath}`]: { body: api.detailResponse(api.draftDetail) },
      [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse },
      [`PATCH ${draftPath}`]: { body: api.detailResponse({ ...api.draftDetail, lock_version: 2 }) },
    });
    await source.updateLease(api.IDS.leaseDraft, { unitId: api.IDS.unit, furnished: false, start: '2026-01-01', durationMonths: '36', tenantIds: [api.IDS.tenant], paymentMethod: 'virement', note: '', rent: '850', charges: '60', deposit: '850', dueDay: '5', asDraft: true });
    const body = callsTo('PATCH', draftPath)[0]?.body as { lock_version: number; parties: { role: string }[]; regime_key: string };
    expect(body.lock_version).toBe(1);
    expect(body.regime_key).toBe('fr.residential.unfurnished');
    expect(body.parties.map((party) => party.role)).toEqual(['tenant', 'guarantor']);
  });
});

describe('actions sur un bail', () => {
  const base = lease(api.IDS.lease);
  const withDetail = (extra: Record<string, MockRoute>) => setup({ [`GET ${base}`]: { body: api.detailResponse(api.leaseDetail) }, ...extra });
  const updated = (patch: Record<string, unknown>) => ({ body: api.detailResponse({ ...api.leaseDetail, lock_version: 4, ...patch }) });

  it('duplique à la suite : le lendemain de la dernière journée du bail', async () => {
    const { source, callsTo } = withDetail({ [`POST ${base}/duplicate`]: { status: 201, body: api.detailResponse({ ...api.draftDetail, starts_on: '2029-01-01', end_date: '2031-12-31' }) } });
    const copy = leaseSchema.parse(await source.duplicateLease(api.IDS.lease));
    expect(callsTo('POST', `${base}/duplicate`)[0]?.body).toEqual({ starts_on: '2029-01-01' });
    expect(copy.status).toBe('brouillon');
  });

  it('archive et restaure', async () => {
    const { source, callsTo } = withDetail({ [`POST ${base}/archive`]: updated({ archived_at: '2026-11-16T10:00:00+00:00' }), [`DELETE ${base}/archive`]: updated({ archived_at: null }) });
    expect(leaseSchema.parse(await source.setLeaseArchived(api.IDS.lease, true)).archived).toBe(true);
    expect(leaseSchema.parse(await source.setLeaseArchived(api.IDS.lease, false)).archived).toBe(false);
    expect(callsTo('POST', `${base}/archive`)).toHaveLength(1);
    expect(callsTo('DELETE', `${base}/archive`)).toHaveLength(1);
  });

  it('supprime un brouillon en l’annulant puis en l’archivant, sans effacer de donnée', async () => {
    const draftPath = lease(api.IDS.leaseDraft);
    const { source, calls } = setup({
      [`GET ${draftPath}`]: { body: api.detailResponse(api.draftDetail) },
      [`POST ${draftPath}/cancel`]: { body: api.detailResponse({ ...api.draftDetail, status: 'cancelled', phase: 'ended', lock_version: 2 }) },
      [`POST ${draftPath}/archive`]: { body: api.detailResponse({ ...api.draftDetail, status: 'cancelled', phase: 'ended', lock_version: 3, archived_at: '2026-11-16T10:00:00+00:00' }) },
    });
    await source.deleteLease(api.IDS.leaseDraft);
    expect(calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`)).toEqual([`POST ${draftPath}/cancel`, `POST ${draftPath}/archive`]);
    expect(calls.find((call) => call.path.endsWith('/cancel'))?.body).toEqual({ lock_version: 1 });
  });

  it('enregistre un préavis du locataire et renvoie le suivi de sortie', async () => {
    const { source, callsTo } = withDetail({ [`POST ${base}/notice`]: { body: api.detailResponse({ ...api.noticeDetail, id: api.IDS.lease }) } });
    const exit = exitSchema.parse(await source.recordNotice(api.IDS.lease, { noticeReceivedOn: '2026-10-01', departure: '2026-11-30', reason: 'Mutation professionnelle' }));
    expect(callsTo('POST', `${base}/notice`)[0]?.body).toEqual({ lock_version: 3, notice_given_by: 'tenant', notice_received_on: '2026-10-01', notice_departure_on: '2026-11-30', termination_reason: 'Mutation professionnelle', replace: false });
    expect(exit).toMatchObject({ leaseId: api.IDS.lease, departure: '2026-11-30' });
  });

  it('révise le loyer à la date du jour puis relit le bail', async () => {
    const { source, callsTo } = withDetail({
      [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse },
      [`POST ${base}/terms/revise`]: { body: api.termsResponse },
    });
    await source.reviseRent(api.IDS.lease, '880');
    expect(callsTo('POST', `${base}/terms/revise`)[0]?.body).toEqual({ lock_version: 3, effective_on: '2026-11-16', reason: 'revision', changes: [{ component_term_id: api.IDS.rentComponent, amount: 88000 }] });
    expect(callsTo('GET', base)).toHaveLength(2);
  });

  it('refuse un loyer invalide ou identique sans appeler le serveur', async () => {
    const { source, callsTo } = withDetail({ [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse } });
    await expect(source.reviseRent(api.IDS.lease, 'abc')).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.reviseRent(api.IDS.lease, '850')).rejects.toMatchObject({ message: 'Le nouveau loyer est identique au loyer actuel.' });
    expect(callsTo('POST', `${base}/terms/revise`)).toHaveLength(0);
  });

  it('signe, annule, résilie en fin exclue, renouvelle, en enchaînant les versions reçues', async () => {
    const { source, callsTo } = withDetail({
      [`POST ${base}/sign`]: updated({}),
      [`POST ${base}/cancel`]: updated({}),
      [`POST ${base}/terminate`]: updated({ status: 'terminated' }),
      [`POST ${base}/renew`]: updated({}),
    });
    await source.signLease(api.IDS.lease);
    await source.cancelLease(api.IDS.lease);
    await source.terminateLease(api.IDS.lease, { lastDay: '2026-12-31' });
    await source.renewLease(api.IDS.lease, { durationMonths: 36 });
    expect(callsTo('POST', `${base}/sign`)[0]?.body).toEqual({ lock_version: 3, signed_on: '2026-11-16' });
    expect(callsTo('POST', `${base}/cancel`)[0]?.body).toEqual({ lock_version: 4 });
    expect(callsTo('POST', `${base}/terminate`)[0]?.body).toEqual({ lock_version: 4, ends_on: '2027-01-01' });
    expect(callsTo('POST', `${base}/renew`)[0]?.body).toEqual({ lock_version: 4, duration_months: 36 });
  });

  it('gère les parties et les lots du bail', async () => {
    const { source, callsTo } = withDetail({
      [`POST ${base}/parties`]: updated({}),
      [`POST ${base}/parties/${api.IDS.tenantLine}/end`]: updated({}),
      [`POST ${base}/units`]: updated({}),
      [`POST ${base}/units/${api.IDS.annexLine}/end`]: updated({}),
    });
    await source.addParty(api.IDS.lease, { partyId: api.IDS.coTenant, role: 'tenant', validFrom: '2026-12-01' });
    await source.endParty(api.IDS.lease, api.IDS.tenantLine, '2026-12-31');
    await source.addUnit(api.IDS.lease, { unitId: api.IDS.annex, validFrom: '2026-12-01' });
    await source.endUnit(api.IDS.lease, api.IDS.annexLine, '2026-12-31');
    expect(callsTo('POST', `${base}/parties`)[0]?.body).toEqual({ lock_version: 3, party_id: api.IDS.coTenant, role: 'tenant', valid_from: '2026-12-01' });
    expect(callsTo('POST', `${base}/parties/${api.IDS.tenantLine}/end`)[0]?.body).toEqual({ lock_version: 4, valid_to: '2027-01-01' });
    expect(callsTo('POST', `${base}/units`)[0]?.body).toEqual({ lock_version: 4, unit_id: api.IDS.annex, valid_from: '2026-12-01' });
    expect(callsTo('POST', `${base}/units/${api.IDS.annexLine}/end`)[0]?.body).toEqual({ lock_version: 4, valid_to: '2027-01-01' });
  });
});

describe('erreurs', () => {
  const base = lease(api.IDS.lease);
  const failing = (status: number, body: unknown) => setup({ [`GET ${base}`]: { status, body } }).source.lease(api.IDS.lease).catch((error: unknown) => error);

  it('401 : session expirée', async () => {
    expect(await failing(401, api.problem(401, 'unauthenticated', 'Non authentifié', 'Authentification requise.'))).toMatchObject({ kind: 'unauthenticated', status: 401 });
  });

  it('403 : droit manquant', async () => {
    expect(await failing(403, api.problem(403, 'forbidden', 'Accès refusé', 'Vous n\'avez pas accès à cette ressource.'))).toMatchObject({ kind: 'forbidden', status: 403 });
  });

  it('404 : bail introuvable', async () => {
    expect(await failing(404, api.problem(404, 'lease_not_found', 'Bail introuvable', 'Ce bail n\'existe pas dans votre organisation.'))).toMatchObject({ kind: 'not_found', code: 'lease_not_found' });
  });

  it('409 : conflit métier', async () => {
    expect(await failing(409, api.problem(409, 'lease_archived', 'Bail archivé', 'Un bail archivé ne se modifie plus.'))).toMatchObject({ kind: 'conflict', code: 'lease_archived', message: 'Un bail archivé ne se modifie plus.' });
  });

  it('422 : première erreur de champ', async () => {
    const body = api.problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { due_day: ['Le jour d’échéance doit être compris entre 1 et 28.'] } });
    expect(await failing(422, body)).toMatchObject({ kind: 'invalid', message: 'Le jour d’échéance doit être compris entre 1 et 28.' });
  });

  it('500 : laisse l’erreur serveur visible, sans la masquer en liste vide', async () => {
    const { source } = setup({ [`GET ${org('/leases')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur interne', 'Une erreur interne est survenue. Réessayez plus tard.') } });
    await expect(source.leases()).rejects.toBeInstanceOf(ApiError);
  });

  it('réseau : conserve l’erreur d’injoignabilité', async () => {
    const { client } = mockApi({});
    const failingClient = { ...client, get: () => Promise.reject(new ApiUnreachableError()) };
    const source = createApiBauxSource({ client: failingClient, organizationId: api.IDS.org });
    await expect(source.leases()).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  it('sans organisation : erreur explicite et aucune requête', async () => {
    const { source, calls } = setup({}, null);
    await expect(source.leases()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });
});

describe('fonctions sans route', () => {
  it('liste explicitement les fonctions sans route et déclare l’occupation dérivée du serveur', () => {
    const { source } = setup({});
    expect(source.unavailableInApiMode).toEqual(BAUX_FEATURES);
    expect(source.derivesOccupancy).toBe(true);
  });

  it.each([
    ['installments', (source: ReturnType<typeof setup>['source']) => source.installments(api.IDS.lease)],
    ['extras', (source: ReturnType<typeof setup>['source']) => source.extras(api.IDS.lease)],
    ['importLeases', (source: ReturnType<typeof setup>['source']) => source.importLeases([])],
    ['setExitStep', (source: ReturnType<typeof setup>['source']) => source.setExitStep(api.IDS.lease, 'restitution', 'fait')],
    ['markReturned', (source: ReturnType<typeof setup>['source']) => source.markReturned(api.IDS.lease, { tenantName: 'Awa Diallo', tenantCivility: 'Mme' })],
    ['edlTemplates', (source: ReturnType<typeof setup>['source']) => source.edlTemplates()],
    ['edls', (source: ReturnType<typeof setup>['source']) => source.edls()],
    ['createEdl', (source: ReturnType<typeof setup>['source']) => source.createEdl({}, false)],
    ['updateEdl', (source: ReturnType<typeof setup>['source']) => source.updateEdl('edl-1', {})],
    ['setEdlStatus', (source: ReturnType<typeof setup>['source']) => source.setEdlStatus('edl-1', 'signe')],
    ['setEdlArchived', (source: ReturnType<typeof setup>['source']) => source.setEdlArchived('edl-1', true)],
    ['deleteEdl', (source: ReturnType<typeof setup>['source']) => source.deleteEdl('edl-1')],
    ['saveEdlSurvey', (source: ReturnType<typeof setup>['source']) => source.saveEdlSurvey('edl-1', [])],
    ['prepareExitEdl', (source: ReturnType<typeof setup>['source']) => source.prepareExitEdl('edl-1')],
    ['reservations', (source: ReturnType<typeof setup>['source']) => source.reservations()],
    ['confirmReservation', (source: ReturnType<typeof setup>['source']) => source.confirmReservation('res-1')],
    ['cancelReservation', (source: ReturnType<typeof setup>['source']) => source.cancelReservation('res-1')],
    ['duplicateReservation', (source: ReturnType<typeof setup>['source']) => source.duplicateReservation('res-1')],
    ['createReservation', (source: ReturnType<typeof setup>['source']) => source.createReservation({})],
    ['updateReservation', (source: ReturnType<typeof setup>['source']) => source.updateReservation('res-1', {})],
    ['importReservations', (source: ReturnType<typeof setup>['source']) => source.importReservations([])],
    ['sendReservationConfirmation', (source: ReturnType<typeof setup>['source']) => source.sendReservationConfirmation('res-1')],
    ['remindReservation', (source: ReturnType<typeof setup>['source']) => source.remindReservation('res-1')],
    ['attestations', (source: ReturnType<typeof setup>['source']) => source.attestations()],
  ])('%s rejette explicitement au lieu de répondre avec des données de démonstration', async (_name, call) => {
    const { source, calls } = setup({});
    await expect(call(source)).rejects.toMatchObject({ kind: 'unsupported' });
    expect(calls).toHaveLength(0);
  });
});

describe('baux non affichables', () => {
  const tacit = { ...api.noticeDetail, id: api.IDS.leaseDraft, reference: 'BL-2026-0010', end_date: null, duration_months: null };
  const foreign = { ...api.leaseDetail, id: api.IDS.leaseArchived, reference: 'BL-2026-0011', currency: 'XOF', archived_at: null };

  const mixedRoutes = (): Record<string, MockRoute> => ({
    [`GET ${org('/leases')}`]: (call) => (call.search.get('archived') === '1' ? { body: api.pageOf([]) } : { body: api.pageOf([api.leaseDetail, tacit, foreign]) }),
    [`GET ${lease(api.IDS.lease)}`]: { body: api.detailResponse(api.leaseDetail) },
    [`GET ${lease(api.IDS.leaseDraft)}`]: { body: api.detailResponse(tacit) },
    [`GET ${lease(api.IDS.leaseArchived)}`]: { body: api.detailResponse(foreign) },
  });

  it('isole un bail sans terme ou en devise étrangère sans rendre la liste inutilisable', async () => {
    const { source } = setup(mixedRoutes());
    const leases = ((await source.leases()) as unknown[]).map((entry) => leaseSchema.parse(entry));

    expect(leases.map((entry) => entry.reference)).toEqual(['BL-2026-0001', 'BL-2026-0010', 'BL-2026-0011']);
    expect(leases[0]?.unsupported).toBeUndefined();
    expect(leases[1]).toMatchObject({ rent: 0, charges: 0, deposit: 0, nextRevision: null });
    expect(leases[1]?.unsupported).toContain('pas de terme');
    expect(leases[2]?.unsupported).toContain('euros');
  });

  it('applique le même isolement aux pages de baux', async () => {
    const { source } = setup({ ...mixedRoutes(), [`GET ${org('/leases')}`]: { body: api.pageOf([api.leaseDetail, foreign]) } });
    const page = await source.leasePage();
    expect(page.items.map((entry) => entry.unsupported === undefined)).toEqual([true, false]);
  });

  it('refuse toujours d’ouvrir un bail non affichable en lecture unitaire', async () => {
    const { source } = setup(mixedRoutes());
    await expect(source.lease(api.IDS.leaseArchived)).rejects.toMatchObject({ kind: 'unsupported' });
  });
});

describe('renouvellement', () => {
  it('appelle POST /leases/{id}/renew avec la version lue du bail', async () => {
    const renewed = { ...api.leaseDetail, end_date: '2031-12-31', lock_version: 4 };
    const { source, callsTo } = setup({
      [`GET ${lease(api.IDS.lease)}`]: { body: api.detailResponse(api.leaseDetail) },
      [`POST ${lease(api.IDS.lease)}/renew`]: { body: api.detailResponse(renewed) },
    });

    const result = leaseSchema.parse(await source.renewLease(api.IDS.lease));

    expect(callsTo('POST', `${lease(api.IDS.lease)}/renew`)[0]?.body).toEqual({ lock_version: 3 });
    expect(result.end).toBe('2031-12-31');
  });
});
