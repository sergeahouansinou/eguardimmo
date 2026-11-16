import { describe, expect, it } from 'vitest';
import { countryCode, countryName } from './country';

describe('pays', () => {
  it.each([
    ['France', 'FR'],
    ['france', 'FR'],
    ['Bénin', 'BJ'],
    ['benin', 'BJ'],
    ['Côte d’Ivoire', 'CI'],
    ['Sénégal', 'SN'],
    ['Allemagne', 'DE'],
    ['FR', 'FR'],
    ['BJ', 'BJ'],
  ])('« %s » donne %s', (text, code) => {
    expect(countryCode(text)).toBe(code);
  });

  it.each([['Atlantide'], [''], ['ZZ'], ['FX'], ['DY']])('refuse « %s »', (text) => {
    expect(countryCode(text)).toBeNull();
  });

  it('nomme les pays en français', () => {
    expect(countryName('FR')).toBe('France');
    expect(countryName('BJ')).toBe('Bénin');
  });
});
