import { describe, expect, it } from 'vitest';
import { actPayload, idsPayload, openCasePayload, optionalReason, validDays } from './recoveryPayloads';

const ID = '01a1e981-cbff-7153-96a5-1f60507478e6';

const ids = (installmentIds: string[], invoiceIds: string[] = []) => ({ installmentIds, invoiceIds });

describe('idsPayload', () => {
  it('dédoublonne et garde l’ordre', () => {
    expect(idsPayload(ids(['a', 'b', 'a']))).toEqual({ installment_ids: ['a', 'b'] });
  });

  it('envoie les factures sous invoice_ids et omet la liste vide', () => {
    expect(idsPayload(ids([], ['f', 'f', 'g']))).toEqual({ invoice_ids: ['f', 'g'] });
    expect(idsPayload(ids(['a'], ['f']))).toEqual({ installment_ids: ['a'], invoice_ids: ['f'] });
  });

  it('refuse l’absence de créance, tous types confondus', () => {
    expect(() => idsPayload(ids([]))).toThrow('au moins une créance');
  });

  it('refuse plus de 100 échéances ou 100 factures, accepte 100 de chaque', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => String(index));
    expect(() => idsPayload(ids(many(101)))).toThrow('100 échéances');
    expect(() => idsPayload(ids(['a'], many(101)))).toThrow('100 factures');
    const full = idsPayload(ids(many(100), many(100)));
    expect(full.installment_ids).toHaveLength(100);
    expect(full.invoice_ids).toHaveLength(100);
  });
});

describe('openCasePayload', () => {
  it('assemble bail, débiteur et créances', () => {
    expect(openCasePayload({ leaseId: 'L', debtorPartyId: 'P', ...ids([ID]) })).toEqual({ lease_id: 'L', debtor_party_id: 'P', installment_ids: [ID] });
  });

  it('ouvre un dossier de factures seules ou mixte', () => {
    expect(openCasePayload({ leaseId: 'L', debtorPartyId: 'P', ...ids([], ['F']) })).toEqual({ lease_id: 'L', debtor_party_id: 'P', invoice_ids: ['F'] });
    expect(openCasePayload({ leaseId: 'L', debtorPartyId: 'P', ...ids([ID], ['F']) })).toEqual({ lease_id: 'L', debtor_party_id: 'P', installment_ids: [ID], invoice_ids: ['F'] });
  });

  it('refuse un bail ou un débiteur vide', () => {
    expect(() => openCasePayload({ leaseId: '', debtorPartyId: 'P', ...ids([ID]) })).toThrow('même bail');
    expect(() => openCasePayload({ leaseId: 'L', debtorPartyId: '', ...ids([ID]) })).toThrow('même bail');
  });
});

describe('optionalReason', () => {
  it('omet un motif vide et rogne les espaces', () => {
    expect(optionalReason('   ')).toEqual({});
    expect(optionalReason(' Réglé ')).toEqual({ reason: 'Réglé' });
  });

  it('refuse plus de 255 caractères', () => {
    expect(() => optionalReason('x'.repeat(256))).toThrow('255');
    expect(optionalReason('x'.repeat(255))).toEqual({ reason: 'x'.repeat(255) });
  });
});

describe('validDays', () => {
  it.each([1, 7, 30])('accepte %i', (days) => { expect(validDays(days)).toBe(days); });
  it.each([0, 31, 1.5, Number.NaN])('refuse %s', (days) => { expect(() => validDays(days)).toThrow('entre 1 et 30'); });
});

describe('actPayload', () => {
  const base = { type: 'call', performedOn: '2026-11-10', note: '', reference: '' } as const;

  it('envoie null pour une note ou une référence vide', () => {
    expect(actPayload(base, '2026-11-16')).toEqual({ type: 'call', performed_on: '2026-11-10', note: null, reference: null });
  });

  it('accepte aujourd’hui et refuse demain', () => {
    expect(actPayload({ ...base, performedOn: '2026-11-16' }, '2026-11-16').performed_on).toBe('2026-11-16');
    expect(() => actPayload({ ...base, performedOn: '2026-11-17' }, '2026-11-16')).toThrow('futur');
  });

  it('refuse une date mal formée, un type automatique et des textes trop longs', () => {
    expect(() => actPayload({ ...base, performedOn: '10/11/2026' }, '2026-11-16')).toThrow('date');
    expect(() => actPayload({ ...base, type: 'transmission' as never }, '2026-11-16')).toThrow('type');
    expect(() => actPayload({ ...base, note: 'x'.repeat(501) }, '2026-11-16')).toThrow('500');
    expect(() => actPayload({ ...base, reference: 'x'.repeat(121) }, '2026-11-16')).toThrow('120');
  });
});
