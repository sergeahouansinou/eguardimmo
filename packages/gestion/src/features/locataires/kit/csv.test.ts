import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('export CSV des listes', () => {
  it('assemble en-têtes et lignes séparés par des points-virgules et des CRLF', () => {
    expect(toCsv(['Locataire', 'Solde'], [['Anaïs Roux', '450,00']])).toBe('Locataire;Solde\r\nAnaïs Roux;450,00');
  });

  it.each(['=1+1', '+33612345678', '@SUM(A1)', '\t=1', '\r=1'])('neutralise la cellule %j que le tableur lirait comme une formule', (value) => {
    const line = toCsv(['A'], [[value]]).split('\r\n').slice(1).join('\r\n');
    expect(line.replace(/^"|"$/g, '').startsWith("'")).toBe(true);
  });

  it('protège séparateur, guillemet et retour à la ligne', () => {
    expect(toCsv(['A'], [['dit "oui"; puis\nnon']])).toBe('A\r\n"dit ""oui""; puis\nnon"');
  });

});
