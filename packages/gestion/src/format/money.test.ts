import { describe, expect, it } from 'vitest';
import { formatCompactMajor, formatMoney, percent, variation } from './money';

const NBSP = ' ';

describe('formatMoney', () => {
  it('affiche les euros ronds sans décimales', () => {
    expect(formatMoney(418_000, 'EUR')).toBe(`4${NBSP}180${NBSP}€`);
  });

  it('garde les centimes quand il y en a', () => {
    expect(formatMoney(65_150, 'EUR')).toBe(`651,50${NBSP}€`);
  });

  it('affiche le FCFA sans décimales', () => {
    expect(formatMoney(250_000, 'XOF')).toBe(`250${NBSP}000${NBSP}F${NBSP}CFA`);
  });

  it('signe un solde positif sur demande', () => {
    expect(formatMoney(264_000, 'EUR', { signed: true })).toBe(`+2${NBSP}640${NBSP}€`);
    expect(formatMoney(-12_000, 'EUR', { signed: true })).toBe(`-120${NBSP}€`);
  });

  it('refuse un montant non entier', () => {
    expect(() => formatMoney(10.5, 'EUR')).toThrow(RangeError);
  });
});

describe('formatCompactMajor', () => {
  it.each([
    [0, '0'],
    [200_000, `2${NBSP}k`],
    [800_000, `8${NBSP}k`],
    [150_000_000, `1,5${NBSP}M`],
  ])('%s centimes donnent %s', (minor, expected) => {
    expect(formatCompactMajor(minor, 'EUR')).toBe(expected);
  });
});

describe('percent et variation', () => {
  it('arrondit le pourcentage et protège la division par zéro', () => {
    expect(percent(418_000, 530_000)).toBe(79);
    expect(percent(10, 11)).toBe(91);
    expect(percent(5, 0)).toBe(0);
  });

  it('calcule la variation relative, nulle sans base', () => {
    expect(variation(264_000, 231_600)).toBe(14);
    expect(variation(100, 0)).toBeNull();
  });
});
