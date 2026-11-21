import { describe, expect, it } from 'vitest';
import type { MaintenanceOrganizationKind, MaintenanceRole } from '../permissions';
import { MaintenanceApiError } from './maintenanceErrors';
import { createApiMaintenanceSource } from './maintenanceSource';
import * as api from './responses.fixtures';
import { mockMaintenanceApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const url = (path = '') => orgPath(api.IDS.org, path);
const NOW = new Date('2026-11-16T10:00:00Z');
const detailPath = (path = '') => url(`/interventions/${api.IDS.intervention}${path}`);

function build(routes: Record<string, MockRoute>, role: MaintenanceRole | null = 'owner', kind: MaintenanceOrganizationKind | null = 'agency', organizationId: string | null = api.IDS.org) {
  const mock = mockMaintenanceApi(routes);
  const source = createApiMaintenanceSource({ client: mock.client, organizationId, role, kind }, { now: () => NOW, fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

describe('permissions', () => {
  it.each([
    ['owner', 'agency', { available: true, write: true, finance: true, settle: true }],
    ['manager', 'agency', { available: true, write: true, finance: true, settle: false }],
    ['accountant', 'agency', { available: true, write: false, finance: true, settle: true }],
    ['owner', 'individual', { available: true, write: true, finance: true, settle: true }],
    ['accountant', 'individual', { available: true, write: false, finance: true, settle: true }],
    ['owner', null, { available: false, write: false, finance: false, settle: false }],
    [null, 'agency', { available: false, write: false, finance: false, settle: false }],
  ] as const)('rôle %s, organisation %s', (role, kind, expected) => {
    expect(build({}, role, kind).source.permissions).toEqual(expected);
  });
});

describe('lectures', () => {
  it('liste avec filtres, curseur et page par défaut', async () => {
    const { source, callsTo } = build({ [`GET ${url('/interventions')}`]: { body: api.interventionsPage } });

    const page = await source.interventions({ status: 'reported', priority: 'urgent', origin: 'tenant', overdue: true, search: 'fuite', supplierPartyId: api.IDS.supplierParty, unitId: api.IDS.unit, cursor: 'abc' });

    expect(Object.fromEntries(callsTo('GET', url('/interventions'))[0]?.search ?? [])).toEqual({
      per_page: '25', cursor: 'abc', status: 'reported', priority: 'urgent', origin: 'tenant', overdue: '1', search: 'fuite', supplier_party_id: api.IDS.supplierParty, unit_id: api.IDS.unit,
    });
    expect(page.items).toHaveLength(4);
    expect(page.items[3]).toMatchObject({ reference: 'INT-2026-0001', status: 'invoiced', origin: 'tenant', supplier: { name: api.suppliersPage.data[0]?.party.name } });
    expect(page.nextCursor).toBeNull();
  });

  it('porte les visites réduites de chaque intervention de la liste', async () => {
    const { source } = build({ [`GET ${url('/interventions')}`]: { body: api.interventionsPage } });

    const { items } = await source.interventions({});

    expect(items[3]?.visits).toEqual([{ id: api.IDS.visit, scheduledOn: '2026-11-19', slot: 'afternoon', status: 'done' }]);
    expect(items.slice(0, 3).map((item) => item.visits)).toEqual([[], [], []]);
  });

  it.each([
    ['visits absent', (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'visits'))],
    ['créneau inconnu', (row: Record<string, unknown>) => ({ ...row, visits: [{ id: api.IDS.visit, scheduled_on: '2026-11-19', slot: 'night', status: 'done' }] })],
    ['date de visite invalide', (row: Record<string, unknown>) => ({ ...row, visits: [{ id: api.IDS.visit, scheduled_on: '19/11/2026', slot: 'morning', status: 'done' }] })],
  ])('rejette une liste dont %s', async (_cas, alter) => {
    const row = api.interventionsPage.data[0] as unknown as Record<string, unknown>;
    const { source } = build({ [`GET ${url('/interventions')}`]: { body: { ...api.interventionsPage, data: [alter(row)] } } });

    await expect(source.interventions({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('filtre par période d’échéance ou de visite, borne de fin exclue', async () => {
    const { source, callsTo } = build({ [`GET ${url('/interventions')}`]: { body: api.interventionsPage } });
    await source.interventions({ dueFrom: '2026-12-01', dueTo: '2027-01-01' });
    expect(Object.fromEntries(callsTo('GET', url('/interventions'))[0]?.search ?? [])).toEqual({ per_page: '25', due_from: '2026-12-01', due_to: '2027-01-01' });
  });

  it('n’envoie aucun filtre inutile sans critère', async () => {
    const { source, callsTo } = build({ [`GET ${url('/interventions')}`]: { body: api.interventionsPage } });
    await source.interventions({});
    expect(Object.fromEntries(callsTo('GET', url('/interventions'))[0]?.search ?? [])).toEqual({ per_page: '25' });
  });

  it('lit la fiche avec devis, accord, facture, imputation et règlement', async () => {
    const { source } = build({ [`GET ${detailPath()}`]: { body: api.settledDetail } });
    const detail = await source.intervention(api.IDS.intervention);
    expect(detail.lockVersion).toBe(9);
    expect(detail.committedAmount).toEqual({ amount: 72000, currency: 'EUR' });
    expect(detail.quotes[0]?.lines[0]).toMatchObject({ quantityMilli: 1000, unitPrice: 60000, taxRatePcm: 20000 });
    expect(detail.approvals[0]).toMatchObject({ status: 'accepted', decidedVia: 'agency_recorded', proofFileId: api.IDS.proof });
    expect(detail.invoices[0]?.allocations[0]?.chargedAmount).toEqual({ amount: 72000, currency: 'EUR' });
    expect(detail.invoices[0]?.payments[0]?.amount.amount).toBe(30000);
  });

  it('lit une fiche sans engagement : le montant engagé est absent, la devise reste connue', async () => {
    const { source } = build({ [`GET ${detailPath()}`]: { body: api.reportedDetail } });
    const detail = await source.intervention(api.IDS.intervention);
    expect(detail.committedAmount).toBeNull();
    expect(detail.currency).toBe('EUR');
    expect(detail.lockVersion).toBe(1);
  });

  it('refuse une réponse hors contrat et une devise non gérée', async () => {
    const broken = build({ [`GET ${detailPath()}`]: { body: { data: { ...api.reportedDetail.data, status: 'inconnu' } } } });
    await expect(broken.source.intervention(api.IDS.intervention)).rejects.toMatchObject({ kind: 'unexpected_response' });
    const dollars = build({ [`GET ${detailPath()}`]: { body: { data: { ...api.reportedDetail.data, committed_amount: { amount: 1, currency: 'USD' } } } } });
    await expect(dollars.source.intervention(api.IDS.intervention)).rejects.toMatchObject({ code: 'unsupported_currency' });
  });

  it('refuse sans organisation, sans appeler le réseau', async () => {
    const { source, calls } = build({}, 'owner', 'agency', null);
    await expect(source.intervention(api.IDS.intervention)).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });

  it('lit les lots, les tiers actifs et les référentiels', async () => {
    const { source, callsTo } = build({
      [`GET ${url('/units')}`]: { body: api.unitsPage },
      [`GET ${url('/parties')}`]: { body: api.partiesPage },
      [`GET ${url('/catalog/vocabularies/intervention_nature/terms')}`]: { body: api.natureTerms },
      [`GET ${url('/catalog/vocabularies/tax_rate/terms')}`]: { body: api.taxRateTerms },
    });
    expect(await source.units('LOT')).toEqual([{ id: api.IDS.unit, label: `${api.unitsPage.data[0]?.reference ?? ''} · ${api.unitsPage.data[0]?.property.name ?? ''}` }]);
    expect(callsTo('GET', url('/units'))[0]?.search.get('q')).toBe('LOT');
    expect((await source.parties()).map((party) => party.name)).toEqual(api.partiesPage.data.map((party) => party.display_name).sort((a, b) => a.localeCompare(b, 'fr')));
    expect((await source.natureTerms()).map((term) => term.label)).toEqual(['Plomberie', 'Électricité', 'Chauffage', 'Serrurerie', 'Humidité', 'Nuisibles', 'Autre']);
    expect((await source.taxRates())[0]).toEqual({ id: api.IDS.rate, key: 'fr_vat_normal', label: 'TVA 20 %', ratePcm: 20000, category: 'S' });
  });
});

describe('écritures sur l’intervention', () => {
  it('crée avec l’en-tête Idempotency-Key et sans identifiant imposé par le client', async () => {
    const { source, callsTo } = build({ [`POST ${url('/interventions')}`]: { status: 201, body: api.reportedDetail } });
    const created = await source.create({ idempotencyKey: 'creation-cle-1', unitId: api.IDS.unit, natureTermId: api.IDS.nature, title: 'Fuite sous l’évier', description: 'Le siphon goutte.', room: '', availability: '', priority: 'normal' });
    const call = callsTo('POST', url('/interventions'))[0];
    expect(created).toEqual({ id: api.IDS.intervention, replayed: false });
    expect(call?.headers.get('Idempotency-Key')).toBe('creation-cle-1');
    expect(call?.body).toEqual({ unit_id: api.IDS.unit, nature_term_id: api.IDS.nature, title: 'Fuite sous l’évier', description: 'Le siphon goutte.', room: null, availability: null, priority: 'normal' });
  });

  it('qualifie avec lock_version et montants en unités mineures', async () => {
    const { source, callsTo } = build({ [`POST ${detailPath('/qualify')}`]: { body: api.reportedDetail } });
    await source.qualify(api.IDS.intervention, { lockVersion: 1, priority: 'urgent', responsibility: 'owner', natureTermId: api.IDS.nature, dueOn: '2026-12-01', estimatedAmount: '400,50', currency: 'EUR' });
    expect(callsTo('POST', detailPath('/qualify'))[0]?.body).toEqual({ lock_version: 1, priority: 'urgent', responsibility: 'owner', nature_term_id: api.IDS.nature, due_on: '2026-12-01', estimated_amount: 40050 });
  });

  it('traduit le 409 de version périmée', async () => {
    const { source } = build({ [`POST ${detailPath('/assign')}`]: { status: 409, body: api.problemBody(409, 'intervention_stale_version', 'Stale') } });
    const failure: unknown = await source.assign(api.IDS.intervention, 1, api.IDS.supplierParty).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MaintenanceApiError);
    expect(failure).toMatchObject({ kind: 'stale', status: 409, code: 'intervention_stale_version' });
  });

  it('n’appelle pas le serveur quand la saisie est invalide', async () => {
    const { source, calls } = build({});
    await expect(source.engage(api.IDS.intervention, { lockVersion: 1, basis: 'emergency', reason: '' })).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.complete(api.IDS.intervention, { lockVersion: 1, completedOn: '2027-01-01', note: 'Fini' })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('couvre engagement, clôture, réouverture, annulation et classement', async () => {
    const paths = ['/engage', '/close', '/reopen', '/cancel', '/decline', '/complete'];
    const { source, callsTo } = build(Object.fromEntries(paths.map((path) => [`POST ${detailPath(path)}`, { body: api.reportedDetail }])));
    await source.engage(api.IDS.intervention, { lockVersion: 2, basis: 'under_ceiling', reason: '' });
    await source.close(api.IDS.intervention, 3, ' Pas de facture ');
    await source.reopen(api.IDS.intervention, 3);
    await source.cancel(api.IDS.intervention, 2);
    await source.decline(api.IDS.intervention, { lockVersion: 1, reason: 'duplicate', note: 'Doublon du 10/11' });
    await source.complete(api.IDS.intervention, { lockVersion: 4, completedOn: '2026-11-15', note: 'Terminé' });
    expect(callsTo('POST', detailPath('/close'))[0]?.body).toEqual({ lock_version: 3, no_invoice_reason: 'Pas de facture' });
    expect(callsTo('POST', detailPath('/reopen'))[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo('POST', detailPath('/decline'))[0]?.body).toEqual({ lock_version: 1, reason: 'duplicate', note: 'Doublon du 10/11' });
    expect(callsTo('POST', detailPath('/complete'))[0]?.body).toEqual({ lock_version: 4, completed_on: '2026-11-15', note: 'Terminé' });
  });
});

describe('pièces, visites, devis et accord', () => {
  it('téléverse une pièce et télécharge son contenu', async () => {
    const { source, callsTo } = build({
      [`POST ${detailPath('/files')}`]: { status: 201, body: { data: { id: api.IDS.file, intervention_id: api.IDS.intervention, kind: 'quote', uploaded_by_kind: 'team', visible_to_owner: false, visible_to_tenant: false, created_at: null } } },
      [`GET ${detailPath(`/files/${api.IDS.file}`)}`]: { pdf: '%PDF-1.4' },
    });
    const id = await source.uploadFile(api.IDS.intervention, { file: new File(['x'], 'devis.pdf', { type: 'application/pdf' }), kind: 'quote', visibleToOwner: false, visibleToTenant: false });
    expect(id).toBe(api.IDS.file);
    expect(callsTo('POST', detailPath('/files'))[0]?.headers.get('Content-Type') ?? '').not.toContain('application/json');
    const blob = await source.downloadFile(api.IDS.intervention, api.IDS.file);
    expect(await blob.text()).toBe('%PDF-1.4');
  });

  it('enregistre une visite, un devis et soumet le devis', async () => {
    const { source, callsTo } = build({
      [`POST ${detailPath('/visits')}`]: { status: 201, body: api.ack(api.IDS.visit) },
      [`POST ${detailPath('/quotes')}`]: { status: 201, body: api.ack(api.IDS.quote) },
      [`POST ${detailPath(`/quotes/${api.IDS.quote}/submit`)}`]: { body: api.ack(api.IDS.quote) },
    });
    await source.addVisit(api.IDS.intervention, { scheduledOn: '2026-11-25', slot: 'afternoon', presenceRequired: true, contactName: 'Danielle', contactPhone: '06 12 34 56 78' });
    await source.addQuote(api.IDS.intervention, {
      reference: 'DEV-778', kind: 'initial', issuedOn: '2026-11-11', validUntil: '', proposedOn: '', message: '', fileId: api.IDS.file, currency: 'EUR',
      lines: [{ label: 'Siphon', quantity: '1', unitPrice: '400', unit: '', taxRateKey: 'fr_vat_normal' }],
    });
    await source.submitQuote(api.IDS.intervention, api.IDS.quote);
    expect(callsTo('POST', detailPath('/visits'))[0]?.body).toMatchObject({ scheduled_on: '2026-11-25', slot: 'afternoon', presence_required: true });
    expect(callsTo('POST', detailPath('/quotes'))[0]?.body).toMatchObject({ file_id: api.IDS.file, lines: [{ quantity_milli: 1000, unit_price: 40000 }] });
  });

  it('enregistre la décision du mandant avec la pièce et signale un rejeu', async () => {
    const path = detailPath(`/approvals/${api.IDS.approval}/record-decision`);
    const { source, callsTo } = build({ [`POST ${path}`]: { body: api.ack(api.IDS.approval, { replayed: true }) } });
    const result = await source.recordDecision(api.IDS.intervention, api.IDS.approval, { decision: 'accept', comment: 'Accord par courriel', proofFileId: api.IDS.proof });
    expect(result).toEqual({ id: api.IDS.approval, replayed: true });
    expect(callsTo('POST', path)[0]?.body).toEqual({ decision: 'accept', comment: 'Accord par courriel', proof_file_id: api.IDS.proof });
  });

  it('refuse la décision sans pièce avant tout appel réseau', async () => {
    const { source, calls } = build({});
    await expect(source.recordDecision(api.IDS.intervention, api.IDS.approval, { decision: 'accept', comment: '', proofFileId: null })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });
});

describe('facture prestataire, imputation et règlement', () => {
  it('enregistre facture, imputation et règlement avec clé d’idempotence dans le corps', async () => {
    const { source, callsTo } = build({
      [`POST ${detailPath('/invoices')}`]: { status: 201, body: api.ack(api.IDS.invoice, { replayed: false }) },
      [`POST ${detailPath(`/invoices/${api.IDS.invoice}/allocations`)}`]: { status: 201, body: api.ack(api.IDS.allocation, { replayed: false }) },
      [`POST ${detailPath(`/invoices/${api.IDS.invoice}/payments`)}`]: { status: 200, body: api.ack(api.IDS.payment, { replayed: true }) },
    });
    const invoice = await source.recordInvoice(api.IDS.intervention, { idempotencyKey: 'facture-cle-1', number: 'F-118', invoiceOn: '2026-11-10', dueOn: '', fileId: api.IDS.file, currency: 'EUR', taxes: [{ taxRateKey: 'fr_vat_normal', base: '400', tax: '80' }] });
    const allocation = await source.allocate(api.IDS.intervention, api.IDS.invoice, { idempotencyKey: 'imputation-cle-1', target: 'deposit', shareAmount: '120', currency: 'EUR', wearPercent: '10', basisNote: 'Dégradation constatée' });
    const payment = await source.recordPayment(api.IDS.intervention, api.IDS.invoice, { idempotencyKey: 'reglement-cle-1', amount: '200', currency: 'EUR', method: 'transfer', paidOn: '2026-11-15', reference: 'VIR-1' });
    expect([invoice.replayed, allocation.replayed, payment.replayed]).toEqual([false, false, true]);
    expect(callsTo('POST', detailPath('/invoices'))[0]?.body).toMatchObject({ idempotency_key: 'facture-cle-1', taxes: [{ base: 40000, tax: 8000 }] });
    expect(callsTo('POST', detailPath(`/invoices/${api.IDS.invoice}/allocations`))[0]?.body).toMatchObject({ target: 'deposit', share_amount: 12000, wear_basis_points: 1000 });
    expect(callsTo('POST', detailPath(`/invoices/${api.IDS.invoice}/payments`))[0]?.headers.get('Idempotency-Key')).toBeNull();
  });

  it('annule une imputation et un règlement par leurs routes propres', async () => {
    const { source, callsTo } = build({
      [`POST ${url(`/allocations/${api.IDS.allocation}/cancel`)}`]: { body: api.ack(api.IDS.allocation) },
      [`POST ${url(`/supplier-payments/${api.IDS.payment}/cancel`)}`]: { body: api.ack(api.IDS.payment) },
    });
    await source.cancelAllocation(api.IDS.allocation);
    await source.cancelPayment(api.IDS.payment);
    expect(callsTo('POST', url(`/allocations/${api.IDS.allocation}/cancel`))).toHaveLength(1);
    expect(callsTo('POST', url(`/supplier-payments/${api.IDS.payment}/cancel`))).toHaveLength(1);
  });

  it('traduit un dépassement de plafond d’imputation (422)', async () => {
    const { source } = build({ [`POST ${detailPath(`/invoices/${api.IDS.invoice}/allocations`)}`]: { status: 422, body: api.problemBody(422, 'allocation_exceeds_invoice', 'Trop') } });
    await expect(source.allocate(api.IDS.intervention, api.IDS.invoice, { idempotencyKey: 'imputation-cle-2', target: 'owner', shareAmount: '999', currency: 'EUR', wearPercent: '', basisNote: '' })).rejects.toThrow('Le cumul des imputations dépasse le total de la facture.');
  });
});

describe('prestataires', () => {
  it('liste, crée, modifie et suspend', async () => {
    const { source, callsTo } = build({
      [`GET ${url('/suppliers')}`]: { body: api.suppliersPage },
      [`POST ${url('/suppliers')}`]: { status: 201, body: api.supplierShow },
      [`PATCH ${url(`/suppliers/${api.IDS.supplier}`)}`]: { body: api.supplierShow },
      [`POST ${url(`/suppliers/${api.IDS.supplier}/suspend`)}`]: { body: api.supplierShow },
    });
    const page = await source.suppliers({ status: 'active' });
    expect(page.items[0]).toMatchObject({ name: api.suppliersPage.data[0]?.party.name, preferred: false, paymentTermsDays: null, tradeTermIds: [], status: 'active' });
    expect(callsTo('GET', url('/suppliers'))[0]?.search.get('status')).toBe('active');
    await source.saveSupplier({ partyId: api.IDS.supplierParty, supplierId: null, tradeTermIds: [api.IDS.electrical], preferred: true, paymentTermsDays: '30', internalNote: '' });
    await source.saveSupplier({ partyId: null, supplierId: api.IDS.supplier, tradeTermIds: [], preferred: false, paymentTermsDays: '', internalNote: 'Note' });
    await source.changeSupplierStatus(api.IDS.supplier, 'suspend');
    expect(callsTo('POST', url('/suppliers'))[0]?.body).toMatchObject({ party_id: api.IDS.supplierParty });
    expect(callsTo('PATCH', url(`/suppliers/${api.IDS.supplier}`))[0]?.body).not.toHaveProperty('party_id');
  });
});
