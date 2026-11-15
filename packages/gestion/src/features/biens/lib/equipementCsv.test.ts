import { describe, expect, it } from 'vitest';
import { parseCsv } from './files';
import { equipementsToCsv } from './equipementCsv';
import type { EquipementRow } from '../schemas/equipements';

const row: EquipementRow = {
  id: 'clim', name: 'Climatiseur « duo »', detail: '3,5 kW', family: 'climatisation', lotId: 'apt-a1', immeubleId: 'les-tilleuls', placeName: 'Apt A1', room: 'Séjour',
  brand: null, model: null, purchasedOn: '2025-06-20', price: 129000, warrantyEndsOn: '2027-06-20', warrantyNote: null, nextMaintenanceOn: '2027-05-20',
  maintenanceNote: null, chargedTo: 'bailleur', status: 'en_service', provider: null, lastVisitOn: null, obligation: null, contractYearly: null, archived: false,
};

describe('export CSV des équipements', () => {
  it('écrit une ligne par équipement avec dates et prix lisibles', () => {
    const table = parseCsv(equipementsToCsv([row], 'EUR'));
    expect(table).toHaveLength(2);
    expect(table[1]).toEqual(['Climatiseur « duo »', '3,5 kW', 'Climatisation', 'Apt A1', '20/06/2025', '1290', '20/06/2027', '20/05/2027', 'Bailleur', 'En service', 'Non']);
  });

  it('laisse vides les champs non renseignés et signale l’archivage', () => {
    const table = parseCsv(equipementsToCsv([{ ...row, purchasedOn: null, price: null, warrantyEndsOn: null, nextMaintenanceOn: null, archived: true, status: 'hors_service' }], 'EUR'));
    expect(table[1]?.slice(4, 8)).toEqual(['', '', '', '']);
    expect(table[1]?.slice(9)).toEqual(['Hors service', 'Oui']);
  });
});
