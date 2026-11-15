import { describe, expect, it } from 'vitest';
import { fillMergeTags } from './mergeTags';

describe('fillMergeTags', () => {
  it('remplace les variables à double et simple accolade par des valeurs d’exemple', () => {
    expect(fillMergeTags('Bonjour {{Prénom}}, {Bien} : {{ Loyer }}.')).toBe('Bonjour Koffi, Apt A1 : 770 €.');
  });

  it('laisse intactes les variables inconnues', () => {
    expect(fillMergeTags('{{Inconnue}} et {constructor}')).toBe('{{Inconnue}} et {constructor}');
  });
});
