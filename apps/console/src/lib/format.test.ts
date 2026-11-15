import { describe, expect, it } from 'vitest';
import { formatEuros, minorToInput, parseEurosToMinor, plural, slugify } from './format';

describe('montants en unités mineures', () => {
  it('lit les euros saisis en centimes entiers', () => {
    expect(parseEurosToMinor('199')).toBe(19900);
    expect(parseEurosToMinor('199,5')).toBe(19950);
    expect(parseEurosToMinor('1 990,00')).toBe(199000);
    expect(parseEurosToMinor('0.99 €')).toBe(99);
  });

  it('refuse les saisies invalides', () => {
    expect(parseEurosToMinor('')).toBeNull();
    expect(parseEurosToMinor('abc')).toBeNull();
    expect(parseEurosToMinor('12,345')).toBeNull();
    expect(parseEurosToMinor('-5')).toBeNull();
  });

  it('formate sans décimales quand elles sont nulles', () => {
    expect(formatEuros(19900)).toBe('199 €');
    expect(formatEuros(19950)).toBe('199,50 €');
    expect(formatEuros(19900, { decimals: 'always' })).toBe('199,00 €');
  });

  it('fait l’aller-retour saisie, centimes, saisie', () => {
    for (const minor of [0, 99, 19900, 19950, 123456]) {
      expect(parseEurosToMinor(minorToInput(minor))).toBe(minor);
    }
  });
});

describe('textes', () => {
  it('accorde le pluriel', () => {
    expect(plural(0, 'profil')).toBe('0 profil');
    expect(plural(1, 'profil')).toBe('1 profil');
    expect(plural(2, 'profil')).toBe('2 profils');
  });

  it('construit des identifiants en kebab-case sans accents', () => {
    expect(slugify('Anaïs Roux')).toBe('anais-roux');
  });
});
