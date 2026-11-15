import { describe, expect, it } from 'vitest';
import { lotsTemplateCsv, lotsToCsv, parseLotsCsv } from './lotCsv';

describe('import et export CSV des lots', () => {
  it('relit le modèle téléchargeable', () => {
    const parsed = parseLotsCsv(lotsTemplateCsv(), 'EUR');
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([{ name: 'Apt E5', immeubleName: 'Les Tilleuls', type: 'appartement', surface: 48.5, rooms: 2, rent: 80000 }]);
  });

  it('signale chaque ligne invalide avec son numéro', () => {
    const content = 'Nom;Immeuble;Type;Surface;Pièces;Loyer\r\nBox 1;Les Tilleuls;Cabane;12;;50\r\n;Les Tilleuls;Parking;abc;x;1,234';
    const parsed = parseLotsCsv(content, 'EUR');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0]).toContain('Ligne 2 : type inconnu « Cabane »');
    expect(parsed.errors[1]).toContain('nom manquant');
    expect(parsed.errors[1]).toContain('surface invalide');
  });

  it('refuse un fichier sans en-têtes', () => {
    expect(parseLotsCsv('Apt;X', 'EUR').errors[0]).toContain('en-têtes');
    expect(parseLotsCsv('', 'EUR').errors).toHaveLength(1);
  });

  it('exporte les lots avec leurs montants lisibles', () => {
    const csv = lotsToCsv(
      [{ id: 'apt-a1', name: 'Apt A1', immeubleId: 'x', immeubleName: 'Les Tilleuls', type: 'appartement', surface: 64.2, rooms: 3, floor: null, tenant: { id: 'k', name: 'Koffi Adjovi' }, rent: 85000, listing: 'hors_ligne', status: 'retard', tantiemes: null, elevatorShares: null, leaseEnd: null, leaseNote: null, archived: false }],
      'EUR',
    );
    expect(csv).toContain('Apt A1;Les Tilleuls;Appartement;64,2;3;Koffi Adjovi;850;Hors ligne;Non');
  });
});
