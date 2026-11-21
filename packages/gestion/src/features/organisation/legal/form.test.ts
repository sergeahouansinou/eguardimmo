import { describe, expect, it } from 'vitest';
import * as fx from './api/responses.fixtures';
import { toLegalIdentity } from './api/legalMapping';
import { apiLegalIdentitySchema } from './api/legalSchemas';
import { emptyDraft, legalFormSchema, minorText, toDraft } from './form';

const filled = () => ({ ...emptyDraft('FR'), legalName: 'Agence du Port', line1: '12 rue du Port', postalCode: '13002', city: 'Marseille', siren: '123 456 782' });

describe('formulaire d’identité légale', () => {
  it('convertit un brouillon minimal : chaînes vides en null, SIREN sans espaces', () => {
    const result = legalFormSchema('EUR').safeParse(filled());

    expect(result.success && result.data).toMatchObject({
      legalName: 'Agence du Port',
      siren: '123456782',
      siret: null,
      vatNumber: null,
      legalForm: null,
      shareCapital: null,
      guaranteeAmount: null,
      paymentTermsDays: null,
      vatRegime: 'normal',
      vatOnDebits: false,
      address: { line1: '12 rue du Port', line2: null, postalCode: '13002', city: 'Marseille', country: 'FR' },
    });
  });

  it('convertit montants en unités mineures et normalise TVA, SIRET et pays', () => {
    const result = legalFormSchema('EUR').safeParse({ ...filled(), shareCapital: '20000,50', guaranteeAmount: '110000', siret: '123 456 782 00019', vatNumber: 'fr 12 345 678 201', country: 'fr', paymentTermsDays: '30' });

    expect(result.success && result.data).toMatchObject({ shareCapital: 2000050, guaranteeAmount: 11000000, siret: '12345678200019', vatNumber: 'FR12345678201', paymentTermsDays: 30, address: { country: 'FR' } });
  });

  it('n’admet pas de décimales en FCFA', () => {
    expect(legalFormSchema('XOF').safeParse({ ...filled(), shareCapital: '1000000' }).success).toBe(true);
    expect(legalFormSchema('XOF').safeParse({ ...filled(), shareCapital: '1000,5' }).success).toBe(false);
  });

  it.each([
    ['legalName', '', 'La raison sociale est obligatoire.'],
    ['siren', '12345', 'Le SIREN comporte 9 chiffres.'],
    ['siren', '', 'Le SIREN est obligatoire.'],
    ['siret', '123', 'Le SIRET comporte 14 chiffres.'],
    ['vatNumber', '1234', 'Deux lettres de pays puis 2 à 12 caractères, par exemple FR12345678901.'],
    ['country', 'France', 'Deux lettres majuscules, par exemple FR.'],
    ['postalCode', '', 'Le code postal est obligatoire.'],
    ['paymentTermsDays', '121', 'Entre 0 et 120 jours.'],
    ['paymentTermsDays', 'abc', 'Nombre de jours entier.'],
    ['shareCapital', '-5', 'Capital social : saisissez un montant valide, par exemple 20000 ou 20000,50.'],
  ] as const)('refuse %s=%j', (field, value, message) => {
    const result = legalFormSchema('EUR').safeParse({ ...filled(), [field]: value });

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });

  it('refoule l’aller-retour : une identité reçue se reconvertit à l’identique', () => {
    const identity = toLegalIdentity(apiLegalIdentitySchema.parse(fx.identity.data));
    const result = legalFormSchema('EUR').safeParse(toDraft(identity));

    expect(result.success && result.data).toEqual({
      legalName: identity.legalName,
      address: identity.address,
      siren: identity.siren,
      siret: identity.siret,
      vatNumber: identity.vatNumber,
      legalForm: identity.legalForm,
      shareCapital: 2000000,
      registryCity: identity.registryCity,
      professionalCardNumber: identity.professionalCardNumber,
      professionalCardIssuer: identity.professionalCardIssuer,
      guaranteeProvider: identity.guaranteeProvider,
      guaranteeAmount: 11000000,
      vatRegime: 'normal',
      vatOnDebits: false,
      paymentTermsDays: 30,
    });
  });

  it('écrit un montant mineur en saisie lisible', () => {
    expect(minorText(2000000, 'EUR')).toBe('20000');
    expect(minorText(2000050, 'EUR')).toBe('20000,50');
    expect(minorText(450000, 'XOF')).toBe('450000');
  });
});
