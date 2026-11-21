import { describe, expect, it } from 'vitest';
import type { LegalIdentityInput, LegalRole } from '../model';
import { LegalApiError } from './legalErrors';
import { createApiLegalIdentitySource } from './legalSource';
import * as fx from './responses.fixtures';
import { legalUrl, mockLegalApi, orgUrl } from './testing';

type Routes = Parameters<typeof mockLegalApi>[0];

function build(routes: Routes, role: LegalRole | null = 'owner', organizationId: string | null = fx.ORG) {
  const mock = mockLegalApi(routes);
  return { ...mock, source: createApiLegalIdentitySource({ client: mock.client, organizationId, role }) };
}

const baseRoutes: Routes = { [`GET ${orgUrl}`]: { body: fx.organization }, [`GET ${legalUrl}`]: { body: fx.identity } };

const input = (overrides: Partial<LegalIdentityInput> = {}): LegalIdentityInput => ({
  legalName: 'Agence du Port SARL',
  address: { line1: '12 rue du Port', line2: null, postalCode: '13002', city: 'Marseille', country: 'FR' },
  siren: '123456782',
  siret: null,
  vatNumber: null,
  legalForm: 'SARL',
  shareCapital: 2000000,
  registryCity: null,
  professionalCardNumber: null,
  professionalCardIssuer: null,
  guaranteeProvider: null,
  guaranteeAmount: null,
  vatRegime: 'normal',
  vatOnDebits: false,
  paymentTermsDays: 30,
  ...overrides,
});

describe('droits selon le rôle', () => {
  it.each([
    ['owner', true],
    ['admin', true],
    ['manager', false],
    ['accountant', false],
    [null, false],
  ] as const)('%s : modifier l’identité légale=%s', (role, edit) => {
    expect(build({}, role).source.permissions).toEqual({ edit });
  });
});

describe('lecture', () => {
  it('charge l’identité, le pays et la devise de l’organisation', async () => {
    const { source } = build(baseRoutes);

    const state = await source.load();

    expect(state.country).toBe('FR');
    expect(state.currency).toBe('EUR');
    expect(state.identity).toMatchObject({
      legalName: 'Agence du Port SARL',
      address: { line1: '12 rue du Port', line2: null, postalCode: '13002', city: 'Marseille', country: 'FR' },
      siren: '123456782',
      shareCapital: { amount: 2000000, currency: 'EUR' },
      guaranteeAmount: { amount: 11000000, currency: 'EUR' },
      vatRegime: 'normal',
      paymentTermsDays: 30,
    });
  });

  it('renvoie une identité absente (404 métier) sans erreur', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${legalUrl}`]: { status: 404, body: fx.problemNotFound } });

    expect(await source.load()).toEqual({ country: 'FR', currency: 'EUR', identity: null });
  });

  it('prend la devise annoncée par le serveur, sans la déduire du pays', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${orgUrl}`]: { body: { data: { country: 'FR', currency: 'CAD' } } } });
    expect((await source.load()).currency).toBe('CAD');
  });

  it('refuse une organisation sans devise au lieu de la déduire du pays', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${orgUrl}`]: { body: { data: { country: 'CA' } } } });
    await expect(source.load()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse une devise annoncée qui n’est pas un code ISO 4217', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${orgUrl}`]: { body: { data: { country: 'FR', currency: 'euro' } } } });

    await expect(source.load()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('propage une autre erreur 404 (organisation introuvable)', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${legalUrl}`]: { status: 404, body: { status: 404, code: 'organization_not_found', title: 'x', detail: 'Cette organisation n\'existe pas.' } } });

    await expect(source.load()).rejects.toMatchObject({ kind: 'not_found', code: 'organization_not_found' });
  });

  it('refuse une réponse hors contrat', async () => {
    const { source } = build({ ...baseRoutes, [`GET ${legalUrl}`]: { body: { data: { legal_name: 'x' } } } });

    await expect(source.load()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse sans organisation, sans appeler le réseau', async () => {
    const { source, calls } = build({}, 'owner', null);

    await expect(source.load()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });
});

describe('enregistrement', () => {
  it('envoie le contrat exact du serveur, montants en unités mineures', async () => {
    const { source, callsTo } = build({ [`PUT ${legalUrl}`]: { body: fx.identity } });

    const saved = await source.save(input({ siret: '12345678200019', guaranteeAmount: 11000000, guaranteeProvider: 'Galian' }));

    expect(callsTo('PUT', legalUrl)[0]?.body).toEqual({
      legal_name: 'Agence du Port SARL',
      address: { line1: '12 rue du Port', line2: null, postal_code: '13002', city: 'Marseille', country: 'FR' },
      siren: '123456782',
      siret: '12345678200019',
      vat_number: null,
      legal_form: 'SARL',
      share_capital: 2000000,
      registry_city: null,
      professional_card_number: null,
      professional_card_issuer: null,
      guarantee_provider: 'Galian',
      guarantee_amount: 11000000,
      vat_regime: 'normal',
      vat_on_debits: false,
      payment_terms_days: 30,
    });
    expect(saved.legalName).toBe('Agence du Port SARL');
  });

  it.each([
    [fx.problemInvalidSiren, 'Le SIREN comporte 9 chiffres.'],
    [fx.problemInvalidLine1, 'La première ligne d’adresse est obligatoire (200 caractères au plus).'],
  ])('traduit un refus 422 par champ', async (body, message) => {
    const { source } = build({ [`PUT ${legalUrl}`]: { status: 422, body } });

    const error = await source.save(input()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(LegalApiError);
    expect(error).toMatchObject({ kind: 'invalid', message });
  });

  it('traduit le refus d’un rôle sans droit', async () => {
    const { source } = build({ [`PUT ${legalUrl}`]: { status: 403, body: fx.problemForbidden } });

    await expect(source.save(input())).rejects.toMatchObject({ kind: 'forbidden', message: 'Seuls le titulaire et les administrateurs peuvent modifier l’identité légale.' });
  });

  it('indique le délai quand la limite de débit est atteinte', async () => {
    const { source } = build({ [`PUT ${legalUrl}`]: { status: 429, body: { status: 429, code: 'too_many_requests', title: 'x', detail: 'x' }, headers: { 'Retry-After': '20' } } });

    await expect(source.save(input())).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringContaining('dans 20 secondes') as unknown });
  });

  it('signale une indisponibilité du service', async () => {
    const { source } = build({ [`PUT ${legalUrl}`]: { status: 503, body: { status: 503, code: 'service_unavailable', title: 'x', detail: 'x' } } });

    await expect(source.save(input())).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
