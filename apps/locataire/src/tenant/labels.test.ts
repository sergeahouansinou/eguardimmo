import { describe, expect, it } from 'vitest';
import { unitDisplayName } from './labels';

describe('unitDisplayName', () => {
  it('ne répète pas le type quand la référence le contient déjà', () => {
    expect(unitDisplayName({ type: 'apartment', reference: 'Appartement A3' })).toBe('Appartement A3');
    expect(unitDisplayName({ type: 'apartment', reference: 'A3' })).toBe('Appartement A3');
  });
});
