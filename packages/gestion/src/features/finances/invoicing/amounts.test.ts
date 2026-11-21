import { describe, expect, it } from 'vitest';
import { formatQuantity, formatRate, lineNet, minorToInput, parseQuantityMilli, parseUnitPrice, previewNet } from './amounts';

describe('quantités en millièmes', () => {
  it.each([
    ['1', 1000],
    ['2,5', 2500],
    ['0.001', 1],
    [' 12 ', 12000],
  ])('lit %s comme %i', (text, milli) => {
    expect(parseQuantityMilli(text)).toBe(milli);
  });

  it.each(['', '0', '-1', '1,0001', 'abc', '1e3', '1 000', '1000001'])('refuse %j', (text) => {
    expect(parseQuantityMilli(text)).toBeNull();
  });

  it('affiche une quantité sans décimale inutile', () => {
    expect(formatQuantity(1000)).toBe('1');
    expect(formatQuantity(2500)).toBe('2,5');
    expect(formatQuantity(1)).toBe('0,001');
  });
});

describe('prix et totaux entiers', () => {
  it('lit un prix selon les décimales de la devise', () => {
    expect(parseUnitPrice('100,50', 'EUR')).toBe(10050);
    expect(parseUnitPrice('45000', 'XOF')).toBe(45000);
    expect(parseUnitPrice('45000,5', 'XOF')).toBeNull();
    expect(parseUnitPrice('100000001', 'EUR')).toBeNull();
  });

  it('arrondit le net d’une ligne au demi supérieur, sans passer par un flottant', () => {
    expect(lineNet(1500, 333)).toBe(500);
    expect(lineNet(333, 3)).toBe(1);
    expect(lineNet(1, 499)).toBe(0);
    expect(lineNet(1, 500)).toBe(1);
    expect(lineNet(1_000_000_000, 10_000_000_000)).toBe(10_000_000_000_000_000);
  });

  it('additionne les nets indicatifs et refuse une ligne incomplète', () => {
    const base = { itemTermId: 't', description: 'x', taxCategory: 'S' as const };
    expect(previewNet([{ ...base, quantity: '2', unitPrice: '10' }, { ...base, quantity: '1,5', unitPrice: '3,33' }], 'EUR')).toBe(2000 + 500);
    expect(previewNet([{ ...base, quantity: '', unitPrice: '10' }], 'EUR')).toBeNull();
  });

  it('remplit un champ de montant depuis des unités mineures', () => {
    expect(minorToInput(12050, 'EUR')).toBe('120,50');
    expect(minorToInput(5, 'EUR')).toBe('0,05');
    expect(minorToInput(45000, 'XOF')).toBe('45000');
  });
});

describe('taux en cent-millièmes', () => {
  it.each([
    [20000, '20 %'],
    [5500, '5,5 %'],
    [9975, '9,975 %'],
    [0, '0 %'],
    [100000, '100 %'],
  ])('affiche %i comme %s', (pcm, text) => {
    expect(formatRate(pcm)).toBe(text);
  });
});
