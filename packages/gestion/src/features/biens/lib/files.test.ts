import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './files';

describe('export CSV des biens', () => {
  it('commence par un BOM et sépare les lignes par CRLF', () => {
    expect(toCsv([['Nom', 'Surface'], ['Apt E5', 48.5]])).toBe('﻿Nom;Surface\r\nApt E5;48.5');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tcmd', '\rcmd'])('neutralise la cellule %j que le tableur lirait comme une formule', (value) => {
    const cell = toCsv([[value]]).slice(1).replace(/^"|"$/g, '');
    expect(cell.startsWith("'")).toBe(true);
  });

  it('garde les nombres négatifs lisibles', () => {
    expect(toCsv([[-12.5, '-3,2']])).toBe('﻿-12.5;-3,2');
  });

  it('se relit avec parseCsv', () => {
    expect(parseCsv(toCsv([['A', 'B'], ['x;y', 'z']]))).toEqual([['A', 'B'], ['x;y', 'z']]);
  });
});
