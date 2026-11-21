import { describe, expect, it } from 'vitest';
import { attachmentCountLabel, fold } from './text';

describe('attachmentCountLabel', () => {
  it.each([
    [0, '0 pièce jointe'],
    [1, '1 pièce jointe'],
    [2, '2 pièces jointes'],
    [5, '5 pièces jointes'],
  ])('accorde %i en français', (count, label) => {
    expect(attachmentCountLabel(count)).toBe(label);
  });
});

describe('fold', () => {
  it('retire les accents et la casse', () => {
    expect(fold('Éléphant')).toBe('elephant');
  });
});
