import { describe, expect, it } from 'vitest';
import { OwnerFundsApiError } from './ownerFundsErrors';
import { BATCH_MAX, assertKey, closePayload, createBatchPayload, depositPayload, executePayload, holdPayload, lockVersionPayload, reasonOf, withdrawalPayload } from './ownerFundsPayloads';

const TODAY = '2026-11-16';
const invalid = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OwnerFundsApiError);
    expect((error as OwnerFundsApiError).kind).toBe('invalid');
    return (error as OwnerFundsApiError).message;
  }
  throw new Error('Une erreur de saisie était attendue');
};

describe('clé de saisie', () => {
  it('accepte 8 à 120 caractères autorisés et refuse le reste', () => {
    expect(assertKey('ui-12345678')).toBe('ui-12345678');
    invalid(() => assertKey('court'));
    invalid(() => assertKey('contient un espace'));
    invalid(() => assertKey('a'.repeat(121)));
  });
});

describe('lot', () => {
  it('envoie des identifiants dédoublonnés, jamais un montant', () => {
    expect(createBatchPayload(['a', 'a', 'b'])).toEqual({ mandant_ids: ['a', 'b'] });
    expect(createBatchPayload(null)).toEqual({});
    invalid(() => createBatchPayload([]));
    invalid(() => createBatchPayload(Array.from({ length: BATCH_MAX + 1 }, (_, index) => String(index))));
  });

  it('exige la version du lot', () => {
    expect(lockVersionPayload(3)).toEqual({ lock_version: 3 });
    invalid(() => lockVersionPayload(0));
    invalid(() => lockVersionPayload(1.5));
  });

  it('borne le motif à 3–500 caractères', () => {
    expect(reasonOf('  Erreur  ')).toBe('Erreur');
    invalid(() => reasonOf('ab'));
    invalid(() => reasonOf('x'.repeat(501)));
  });
});

describe('exécution', () => {
  it('envoie date, référence et reconnaissance seulement si présentes', () => {
    expect(executePayload({ executedOn: TODAY, reference: '', acknowledgeAccountChange: false }, TODAY)).toEqual({ executed_on: TODAY });
    expect(executePayload({ executedOn: '2026-11-10', reference: 'VIR-1', acknowledgeAccountChange: true }, TODAY)).toEqual({ executed_on: '2026-11-10', reference: 'VIR-1', acknowledge_account_change: true });
  });

  it('refuse une date future, absente ou antérieure à 2000, et une référence avec espace ou @', () => {
    invalid(() => executePayload({ executedOn: '2026-11-17', reference: '', acknowledgeAccountChange: false }, TODAY));
    invalid(() => executePayload({ executedOn: '', reference: '', acknowledgeAccountChange: false }, TODAY));
    invalid(() => executePayload({ executedOn: '1999-12-31', reference: '', acknowledgeAccountChange: false }, TODAY));
    invalid(() => executePayload({ executedOn: TODAY, reference: 'jean dupont', acknowledgeAccountChange: false }, TODAY));
    invalid(() => executePayload({ executedOn: TODAY, reference: 'a@b.fr', acknowledgeAccountChange: false }, TODAY));
    invalid(() => executePayload({ executedOn: TODAY, reference: 'x'.repeat(65), acknowledgeAccountChange: false }, TODAY));
  });
});

describe('retenue', () => {
  const base = { mandantId: 'm', kind: 'full', amount: '', currency: 'EUR', reason: 'dispute', comment: '' } as const;

  it('un blocage total n’envoie aucun montant', () => {
    expect(holdPayload({ ...base, amount: '50' })).toEqual({ mandant_party_id: 'm', kind: 'full', reason: 'dispute' });
  });

  it('une réserve envoie le montant en unités mineures', () => {
    expect(holdPayload({ ...base, kind: 'reserve', amount: '200,50', comment: ' toiture ' })).toEqual({ mandant_party_id: 'm', kind: 'reserve', amount: 20050, reason: 'dispute', comment: 'toiture' });
    expect(holdPayload({ ...base, kind: 'reserve', amount: '5000', currency: 'XOF' })).toMatchObject({ amount: 5000 });
  });

  it('refuse une réserve nulle, un mandant vide et un commentaire trop long', () => {
    invalid(() => holdPayload({ ...base, kind: 'reserve', amount: '0' }));
    invalid(() => holdPayload({ ...base, kind: 'reserve', amount: 'abc' }));
    invalid(() => holdPayload({ ...base, mandantId: '' }));
    invalid(() => holdPayload({ ...base, comment: 'x'.repeat(501) }));
  });
});

describe('prélèvement et apport', () => {
  const input = { amount: '1 500', currency: 'EUR', executedOn: TODAY, reference: '' } as const;

  it('convertit le montant saisi en unités mineures sans flottant', () => {
    expect(withdrawalPayload({ ...input, amount: '1500,10' }, TODAY)).toEqual({ amount: 150010, executed_on: TODAY });
    expect(withdrawalPayload({ ...input, amount: '0,07', reference: 'VIR-9' }, TODAY)).toEqual({ amount: 7, executed_on: TODAY, reference: 'VIR-9' });
    invalid(() => withdrawalPayload({ ...input, amount: '10,999' }, TODAY));
    invalid(() => withdrawalPayload({ ...input, amount: '-5' }, TODAY));
  });

  it('l’apport exige une référence de 3 à 64 caractères', () => {
    expect(depositPayload({ ...input, amount: '100', reference: 'VIR-001' }, TODAY)).toEqual({ amount: 10000, executed_on: TODAY, reference: 'VIR-001' });
    invalid(() => depositPayload({ ...input, amount: '100', reference: '' }, TODAY));
    invalid(() => depositPayload({ ...input, amount: '100', reference: 'ab' }, TODAY));
  });
});

describe('clôture', () => {
  it('accepte AAAA-MM et refuse le reste', () => {
    expect(closePayload('2026-11')).toEqual({ month: '2026-11' });
    invalid(() => closePayload('2026-13'));
    invalid(() => closePayload('1999-12'));
    invalid(() => closePayload('2026-11-01'));
  });
});
