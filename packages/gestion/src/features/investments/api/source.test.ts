import { describe, expect, it } from 'vitest';
import { OrgApiError } from '../../orgapi/errors';
import { mockOrgApi, orgPath, problem } from '../../orgapi/testing';
import type { MockRoute } from '../../orgapi/testing';
import { NO_LOAN_FILTERS } from '../model';
import * as api from './fixtures';
import { createApiInvestmentsSource } from './source';

const url = (path = '') => orgPath(api.IDS.org, `/investments${path}`);

function setup(routes: Record<string, MockRoute>) {
  const mock = mockOrgApi(routes);
  const source = createApiInvestmentsSource({ client: mock.client, organizationId: api.IDS.org }, { fetchImpl: mock.fetchImpl });
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

const input = {
  propertyId: api.IDS.property,
  unitId: null,
  lenderLabel: 'Banque Populaire',
  contractReference: null,
  purpose: 'acquisition' as const,
  principal: 15_000_000,
  nominalRate: '3.45',
  firstDueOn: '2025-02-05',
  termMonths: 240,
  deferralKind: 'none' as const,
  deferralMonths: 0,
  insuranceMode: 'none' as const,
  insuranceRate: null,
  insuranceAmount: null,
  replacesLoanId: null,
  document: null,
};

describe('source API des prêts et du coût de revient', () => {
  it('lit la liste des prêts, transmet les filtres et masque la référence du contrat', async () => {
    const { source, calls } = setup({ [`GET ${url('/loans')}`]: { body: { data: [api.loanBase, api.loanTwo] } } });
    const loans = await source.loans({ propertyId: api.IDS.property, status: 'active' });
    expect(loans).toHaveLength(2);
    expect(loans[0]).toMatchObject({ lenderLabel: 'Banque Populaire', contractReference: '…0001', nominalRate: '3.45000', detailed: false, lockVersion: 3 });
    expect(loans[0]?.outstanding).toEqual({ asOf: '2026-11-21', amount: { amount: 13_800_000, currency: 'EUR' } });
    expect(loans[1]).toMatchObject({ status: 'voided', voidReason: 'Saisie en double' });
    expect(Object.fromEntries(calls[0]?.search.entries() ?? [])).toEqual({ property_id: api.IDS.property, status: 'active' });
  });

  it('n’envoie aucun filtre vide', async () => {
    const { source, calls } = setup({ [`GET ${url('/loans')}`]: { body: { data: [] } } });
    await source.loans(NO_LOAN_FILTERS);
    expect([...(calls[0]?.search.keys() ?? [])]).toEqual([]);
  });

  it('lit la fiche avec frais et attestations, et l’échéancier', async () => {
    const { source } = setup({
      [`GET ${url(`/loans/${api.IDS.loan}`)}`]: { body: { data: api.loanDetail } },
      [`GET ${url(`/loans/${api.IDS.loan}/schedule`)}`]: { body: { data: api.schedule } },
    });
    const loan = await source.loan(api.IDS.loan);
    expect(loan.detailed).toBe(true);
    expect(loan.contractReference).toBe('PRET-2025-0001');
    expect(loan.fees[0]).toMatchObject({ kind: 'dossier', paidOn: '2025-01-10', hasFile: false });
    expect(loan.attestations[0]).toMatchObject({ incomeYear: 2025, hasFile: true });
    const schedule = await source.schedule(api.IDS.loan);
    expect(schedule.lines).toHaveLength(3);
    expect(schedule.lines[1]).toMatchObject({ dueOn: '2026-12-05', total: { amount: 88_000, currency: 'EUR' }, outstandingAfter: { amount: 13_756_000, currency: 'EUR' } });
    expect(schedule.totals.interest.amount).toBe(126_125);
  });

  it('crée un prêt avec une clé d’idempotence et sans champ calculé', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/loans')}`]: { status: 201, body: { data: api.loanBase } } });
    const loan = await source.createLoan(input, 'ui-cle-1234');
    expect(loan.id).toBe(api.IDS.loan);
    const call = callsTo('POST', url('/loans'))[0];
    expect(call?.headers.get('Idempotency-Key')).toBe('ui-cle-1234');
    expect(call?.body).toEqual({
      property_id: api.IDS.property, lender_label: 'Banque Populaire', purpose: 'acquisition', principal: 15_000_000, nominal_rate: '3.45', first_due_on: '2025-02-05',
      term_months: 240, deferral_kind: 'none', deferral_months: 0, insurance_mode: 'none',
    });
  });

  it('envoie un prêt avec pièce en multipart', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/loans')}`]: { status: 201, body: { data: api.loanBase } } });
    await source.createLoan({ ...input, document: new File(['x'], 'offre.pdf', { type: 'application/pdf' }) }, 'ui-cle-1234');
    const form = callsTo('POST', url('/loans'))[0]?.form;
    expect(form?.get('lender_label')).toBe('Banque Populaire');
    expect(form?.get('document')).toBeInstanceOf(File);
  });

  it('enregistre un remboursement anticipé avec la version lue', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/loans/${api.IDS.loan}/prepayments`)}`]: { status: 201, body: { data: api.loanBase } } });
    await source.prepay(api.IDS.loan, { date: '2026-12-05', amount: 500_000, option: 'reduce_term', penalty: 0, lockVersion: 3 });
    expect(callsTo('POST', url(`/loans/${api.IDS.loan}/prepayments`))[0]?.body).toEqual({ date: '2026-12-05', amount: 500_000, option: 'reduce_term', penalty: 0, lock_version: 3 });
  });

  it('importe un tableau en multipart avec la version lue', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/loans/${api.IDS.loan}/schedule/import`)}`]: { body: { data: { ...api.loanBase, schedule_source: 'imported' } } } });
    const loan = await source.importSchedule(api.IDS.loan, new File(['a;b'], 'tableau.csv', { type: 'text/csv' }), 3);
    expect(loan.scheduleSource).toBe('imported');
    const form = callsTo('POST', url(`/loans/${api.IDS.loan}/schedule/import`))[0]?.form;
    expect(form?.get('lock_version')).toBe('3');
    expect(form?.get('file')).toBeInstanceOf(File);
  });

  it('ajoute des frais et une attestation', async () => {
    const { source, callsTo } = setup({
      [`POST ${url(`/loans/${api.IDS.loan}/fees`)}`]: { status: 201, body: { data: { ...api.loanDetail.fees[0], loan_id: api.IDS.loan } } },
      [`POST ${url(`/loans/${api.IDS.loan}/attestations`)}`]: { status: 201, body: { data: { ...api.loanDetail.attestations[0], loan_id: api.IDS.loan } } },
    });
    await source.addFee(api.IDS.loan, { kind: 'dossier', paidOn: '2025-01-10', amount: 150_000, document: null });
    await source.addAttestation(api.IDS.loan, { incomeYear: 2025, interest: 480_000, insurance: 0, fees: 0, document: new File(['x'], 'attestation.pdf', { type: 'application/pdf' }) });
    expect(callsTo('POST', url(`/loans/${api.IDS.loan}/fees`))[0]?.body).toEqual({ kind: 'dossier', paid_on: '2025-01-10', amount: 150_000 });
    const form = callsTo('POST', url(`/loans/${api.IDS.loan}/attestations`))[0]?.form;
    expect(form?.get('income_year')).toBe('2025');
    expect(form?.get('interest')).toBe('480000');
  });

  it('annule la saisie avec motif et version', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/loans/${api.IDS.loan}/void`)}`]: { body: { data: api.loanTwo } } });
    const loan = await source.voidLoan(api.IDS.loan, 'Saisie en double', 3);
    expect(loan.status).toBe('voided');
    expect(callsTo('POST', url(`/loans/${api.IDS.loan}/void`))[0]?.body).toEqual({ reason: 'Saisie en double', lock_version: 3 });
  });

  it('lit, crée et modifie un coût de revient', async () => {
    const { source, callsTo } = setup({
      [`GET ${url('/acquisitions')}`]: { body: { data: [api.acquisition] } },
      [`POST ${url('/acquisitions')}`]: { status: 201, body: { data: api.acquisition } },
      [`PATCH ${url(`/acquisitions/${api.IDS.acquisition}`)}`]: { body: { data: { ...api.acquisition, lock_version: 2 } } },
    });
    const list = await source.acquisitions(api.IDS.property);
    expect(list[0]).toMatchObject({ cost: { amount: 23_000_000, currency: 'EUR' }, acquiredOn: '2025-01-10', lockVersion: 1 });
    await source.createAcquisition({ propertyId: api.IDS.property, unitId: null, acquiredOn: '2025-01-10', price: 20_000_000, acquisitionCosts: 0, agencyFees: 0, initialWorks: 0, document: null }, 'ui-cle-5678');
    expect(callsTo('POST', url('/acquisitions'))[0]?.headers.get('Idempotency-Key')).toBe('ui-cle-5678');
    const updated = await source.updateAcquisition(api.IDS.acquisition, { acquiredOn: '2025-01-10', price: 20_000_000, acquisitionCosts: 0, agencyFees: 0, initialWorks: 0, lockVersion: 1 });
    expect(updated.lockVersion).toBe(2);
    expect(callsTo('PATCH', url(`/acquisitions/${api.IDS.acquisition}`))[0]?.body).toMatchObject({ lock_version: 1, price: 20_000_000 });
  });

  it('refuse une organisation sans devise au lieu de la déduire du pays, et une devise qui n’est pas un code ISO', async () => {
    const sansDevise = Object.fromEntries(Object.entries(api.organization.data).filter(([key]) => key !== 'currency'));
    const absente = setup({ [`GET ${orgPath(api.IDS.org, '')}`]: { body: { data: sansDevise } } });
    await expect(absente.source.currency()).rejects.toMatchObject({ kind: 'unexpected_response' });
    const invalide = setup({ [`GET ${orgPath(api.IDS.org, '')}`]: { body: { data: { ...sansDevise, currency: 'euro' } } } });
    await expect(invalide.source.currency()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('prend la devise annoncée par le serveur et ne gère que l’euro', async () => {
    const eur = setup({ [`GET ${orgPath(api.IDS.org, '')}`]: { body: api.organization } });
    expect(await eur.source.currency()).toBe('EUR');
    const ca = setup({ [`GET ${orgPath(api.IDS.org, '')}`]: { body: { data: { ...api.organization.data, country: 'CA', currency: 'CAD' } } } });
    expect(await ca.source.currency()).toBeNull();
    const horsPays = setup({ [`GET ${orgPath(api.IDS.org, '')}`]: { body: { data: { ...api.organization.data, country: 'KE', currency: 'EUR' } } } });
    expect(await horsPays.source.currency()).toBe('EUR');
  });

  it.each([
    [401, 'unauthenticated', 'unauthenticated'],
    [403, 'investments_landlord_only', 'forbidden'],
    [404, 'loan_not_found', 'not_found'],
    [409, 'loan_version_conflict', 'stale'],
    [409, 'loan_state_invalid', 'conflict'],
    [409, 'loan_in_use', 'conflict'],
    [422, 'loan_terms_invalid', 'invalid'],
    [429, 'too_many_requests', 'rate_limited'],
  ])('traduit l’erreur %i %s en %s', async (status, code, kind) => {
    const { source } = setup({ [`GET ${url(`/loans/${api.IDS.loan}`)}`]: problem(status, code, 'Message du serveur') });
    const error = await failure(source.loan(api.IDS.loan));
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
  });

  it('refuse une réponse dont la devise est inconnue', async () => {
    const bad = { ...api.loanBase, principal: { amount: 100, currency: 'GBP' } };
    const { source } = setup({ [`GET ${url(`/loans/${api.IDS.loan}`)}`]: { body: { data: bad } } });
    expect((await failure(source.loan(api.IDS.loan))).kind).toBe('unexpected_response');
  });

  it('refuse un montant décimal', async () => {
    const bad = { ...api.loanBase, principal: { amount: 100.5, currency: 'EUR' } };
    const { source } = setup({ [`GET ${url('/loans')}`]: { body: { data: [bad] } } });
    expect((await failure(source.loans(NO_LOAN_FILTERS))).kind).toBe('unexpected_response');
  });
});
