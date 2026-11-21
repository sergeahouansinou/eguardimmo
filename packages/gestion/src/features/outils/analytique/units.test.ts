import { describe, expect, it } from 'vitest';
import { allocate, fitTotal } from './allocate';
import { niceScale } from './charts/scale';
import { buildCsv } from './csv';

describe('allocate', () => {
  it('répartit au centime près sans perdre le total', () => {
    const parts = allocate(10000, [1, 1, 1]);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(10000);
    expect(parts).toEqual([3334, 3333, 3333]);
  });

  it('ajuste une série pour retrouver exactement la cible', () => {
    expect(fitTotal([100, 200, 300], 700).reduce((sum, value) => sum + value, 0)).toBe(700);
  });
});

describe('niceScale', () => {
  it('arrondit le sommet de l’axe à un pas lisible', () => {
    const { step, top } = niceScale(4880 * 100, 4);
    expect(top).toBeGreaterThanOrEqual(4880 * 100);
    expect(top % step).toBe(0);
  });

  it('gère une série nulle', () => {
    expect(niceScale(0, 4).top).toBeGreaterThan(0);
  });
});

describe('buildCsv', () => {
  it('produit un CSV à point-virgule avec BOM, montants décimaux et cellules protégées', () => {
    const csv = buildCsv({
      columns: ['Lot', 'Montant'],
      rows: [
        ['Apt A1', { minor: 123456 }],
        ['=CMD()', 5],
        ['Dit "bonjour"; ok', null],
      ],
    });
    expect(csv.startsWith('﻿Lot;Montant\r\n')).toBe(true);
    expect(csv).toContain('Apt A1;1234,56\r\n');
    expect(csv).toContain("'=CMD();5\r\n");
    expect(csv).toContain('"Dit ""bonjour""; ok";\r\n');
  });

  it('neutralise une formule HYPERLINK et garde un montant négatif lisible', () => {
    const csv = buildCsv({ columns: ['Lot', 'Montant'], rows: [['=HYPERLINK("http://x";"y")', { minor: -123456 }]] });
    expect(csv).toContain('"\'=HYPERLINK(""http://x"";""y"")";-1234,56\r\n');
  });
});
