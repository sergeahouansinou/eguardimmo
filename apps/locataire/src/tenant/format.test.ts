import { describe, expect, it } from 'vitest';
import { NOT_AVAILABLE, formatApiMoney, formatBasisPoints, formatFloor, formatSurface, sumMoney } from './format';

describe('montants {amount, currency}', () => {
  it('lit l’euro en centimes', () => {
    expect(formatApiMoney({ amount: 65000, currency: 'EUR' })).toBe('650 €');
    expect(formatApiMoney({ amount: 65050, currency: 'EUR' })).toBe('650,50 €');
  });

  it('lit le franc CFA sans décimales', () => {
    expect(formatApiMoney({ amount: 150000, currency: 'XOF' })).toMatch(/^150 000\s(F\s?CFA|FCFA|CFA)/);
  });

  it('additionne dans une seule devise, sinon refuse', () => {
    expect(sumMoney([{ amount: 100, currency: 'EUR' }, { amount: 250, currency: 'EUR' }])).toEqual({ amount: 350, currency: 'EUR' });
    expect(sumMoney([{ amount: 100, currency: 'EUR' }, { amount: 250, currency: 'XOF' }])).toBeNull();
    expect(sumMoney([])).toBeNull();
  });
});

describe('autres formats', () => {
  it('surface en centièmes de m²', () => {
    expect(formatSurface(4250)).toBe('42,5 m²');
    expect(formatSurface(null)).toBe(NOT_AVAILABLE);
  });

  it('étage', () => {
    expect(formatFloor(0)).toBe('Rez-de-chaussée');
    expect(formatFloor(1)).toBe('1er étage');
    expect(formatFloor(3)).toBe('3e étage');
    expect(formatFloor(-1)).toBe('Sous-sol 1');
    expect(formatFloor(null)).toBe(NOT_AVAILABLE);
  });

  it('TVA en points de base', () => {
    expect(formatBasisPoints(0)).toBe('0 %');
    expect(formatBasisPoints(1800)).toBe('18 %');
    expect(formatBasisPoints(550)).toBe('5,5 %');
  });
});
