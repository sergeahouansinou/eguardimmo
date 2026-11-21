import { describe, expect, it } from 'vitest';
import { CURRENCIES, formatAmountInput, formatCompactMajor, formatMoney, isCurrency, minorDigits, parseAmount, percent, variation } from './money';

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

  it('affiche le dollar canadien avec ses deux décimales', () => {
    expect(formatMoney(418_000, 'CAD')).toBe(`4${NBSP}180${NBSP}$CA`);
    expect(formatMoney(65_150, 'CAD')).toBe(`651,50${NBSP}$CA`);
    expect(formatMoney(-12_000, 'CAD', { signed: true })).toBe(`-120${NBSP}$CA`);
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

describe('saisie par devise', () => {
  it('lit les euros en centimes, sans flottant', () => {
    expect(parseAmount('850', 'EUR')).toBe(85_000);
    expect(parseAmount('1 234,56', 'EUR')).toBe(123_456);
    expect(parseAmount('0,29', 'EUR')).toBe(29);
    expect(parseAmount('1.15', 'EUR')).toBe(115);
    expect(parseAmount('12,345', 'EUR')).toBeNull();
  });

  it('lit les francs CFA sans décimales', () => {
    expect(parseAmount('250 000', 'XOF')).toBe(250_000);
    expect(parseAmount(`250${NBSP}000`, 'XOF')).toBe(250_000);
    expect(parseAmount('250 000,5', 'XOF')).toBeNull();
    expect(parseAmount('250.0', 'XOF')).toBeNull();
  });

  it('refuse les saisies invalides', () => {
    ['', 'abc', '-5', '1e3', '12.3.4', '9999999999'].forEach((text) => {
      expect(parseAmount(text, 'EUR')).toBeNull();
      expect(parseAmount(text, 'XOF')).toBeNull();
    });
  });

  it('reformate pour un champ avec l’exposant de la devise', () => {
    expect(formatAmountInput(85_050, 'EUR')).toBe('850,50');
    expect(formatAmountInput(85_005, 'EUR')).toBe('850,05');
    expect(formatAmountInput(250_000, 'XOF')).toBe('250000');
    expect(formatAmountInput(-5, 'EUR')).toBe('-0,05');
    expect(parseAmount(formatAmountInput(85_005, 'EUR'), 'EUR')).toBe(85_005);
    expect(() => formatAmountInput(10.5, 'XOF')).toThrow(RangeError);
  });
});

describe('devises prises en charge', () => {
  it('déclare les décimales de chaque devise', () => {
    expect(CURRENCIES.map((currency) => [currency, minorDigits(currency)])).toEqual([['EUR', 2], ['XOF', 0], ['CAD', 2]]);
  });

  it('reconnaît seulement les codes pris en charge', () => {
    expect(isCurrency('CAD')).toBe(true);
    expect(isCurrency('GBP')).toBe(false);
  });

  it('lit et écrit les montants en CAD à deux décimales et en XOF sans décimales', () => {
    expect(parseAmount('1 250,5', 'CAD')).toBe(125_050);
    expect(parseAmount('1250,505', 'CAD')).toBeNull();
    expect(parseAmount('1 250', 'XOF')).toBe(1_250);
    expect(parseAmount('1250,5', 'XOF')).toBeNull();
    expect(formatAmountInput(125_050, 'CAD')).toBe('1250,50');
    expect(formatAmountInput(1_250, 'XOF')).toBe('1250');
  });
});
