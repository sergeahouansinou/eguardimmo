import { describe, expect, it } from 'vitest';
import { csvCell, csvLine, csvDocument } from './csv';

describe('export CSV sûr', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tcmd', '\rcmd'])('préfixe d’une apostrophe la cellule %j que le tableur lirait comme une formule', (value) => {
    expect(csvCell(value).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
  });

  it('laisse intacts les nombres, y compris négatifs', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('-12,50')).toBe('-12,50');
    expect(csvCell(42)).toBe('42');
  });

  it('met entre guillemets les points-virgules, guillemets et retours à la ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('ligne1\nligne2')).toBe('"ligne1\nligne2"');
    expect(csvCell('ligne1\rligne2')).toBe('"ligne1\rligne2"');
  });

  it('neutralise une formule qui contient aussi un séparateur', () => {
    expect(csvCell('=HYPERLINK("http://x";"y")')).toBe('"\'=HYPERLINK(""http://x"";""y"")"');
  });

  it('rend vide une cellule absente', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('assemble des lignes séparées par des points-virgules et des retours chariot', () => {
    expect(csvLine(['a', 1, null])).toBe('a;1;');
    expect(csvDocument([['x', '=y'], ['z']])).toBe("x;'=y\r\nz");
  });
});
