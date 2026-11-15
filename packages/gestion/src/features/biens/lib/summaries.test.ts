import { describe, expect, it } from 'vitest';
import { diagnosticSummary, equipementLine, maintenanceStatus, periodDetail, warrantyLabel } from './summaries';
import type { EquipementRow } from '../schemas/equipements';
import type { Diagnostic, Period } from '../schemas/lots';

const base: Diagnostic = { id: 'd', label: 'DPE', doneOn: '2024-03-12', validity: '10 ans', expiresOn: '2034-03-11', expiresNote: null, result: 'Classe C, GES B', ratings: null, status: 'valide', hasFile: true, orderedOn: null };

const equipement: EquipementRow = {
  id: 'e', name: 'Clim', detail: '', family: 'climatisation', lotId: null, immeubleId: null, placeName: 'Apt A1', room: null, brand: null, model: null,
  purchasedOn: null, price: null, warrantyEndsOn: null, warrantyNote: null, nextMaintenanceOn: null, maintenanceNote: null, chargedTo: 'bailleur',
  status: 'en_service', provider: null, lastVisitOn: null, obligation: null, contractYearly: null, archived: false,
};

describe('résumés', () => {
  it('décrit la validité d’un diagnostic selon son statut', () => {
    expect(diagnosticSummary(base)).toBe('Classe C, GES B, valide jusqu’au 11/03/2034');
    expect(diagnosticSummary({ ...base, status: 'expire', expiresOn: '2026-02-10' })).toBe('Expiré le 10/02/2026');
    expect(diagnosticSummary({ ...base, status: 'a_refaire', expiresOn: null, expiresNote: 'Prochain bail' })).toBe('À refaire au prochain bail');
    expect(diagnosticSummary({ ...base, status: 'sans_objet', result: 'Hors zone' })).toBe('Hors zone');
  });

  it('décrit un bail en cours et une vacance', () => {
    const bail: Period = { id: 'p', kind: 'bail', startDate: '2023-04-01', endDate: null, occupant: { id: 'k', name: 'Koffi' }, leaseType: null, note: null, status: 'en_cours', noticeEndsOn: null, entryRent: null, lastRent: null, deposit: null, exitNote: null };
    expect(periodDetail(bail, '2026-11-13')).toBe('Depuis le 01/04/2023 · 3 ans 7 mois · bail en cours');
    const vacance: Period = { ...bail, id: 'v', kind: 'vacance', endDate: '2023-03-31', startDate: '2023-03-16', occupant: null, status: null, note: 'Peinture du séjour' };
    expect(periodDetail(vacance, '2026-11-13')).toBe('Vacance, 15 jours · Peinture du séjour');
  });

  it('qualifie la garantie d’un équipement', () => {
    expect(warrantyLabel({ warrantyEndsOn: '2027-06-20' }, '2026-11-13').label).toBe('Jusqu’au 20/06/2027');
    expect(warrantyLabel({ warrantyEndsOn: '2021-03-12' }, '2026-11-13').label).toBe('Expirée le 12/03/2021');
    expect(warrantyLabel({ warrantyEndsOn: null }, '2026-11-13').label).toBe('Non renseignée');
    const row = { ...equipement, room: 'Séjour', warrantyEndsOn: '2027-06-20', nextMaintenanceOn: '2027-05-20' };
    expect(equipementLine(row, '2026-11-13')).toBe('Séjour · garantie jusqu’au 20/06/2027 · entretien 05/2027');
  });

  it('qualifie l’échéance d’entretien par rapport à la date du jour', () => {
    expect(maintenanceStatus({ nextMaintenanceOn: null }, '2026-11-13')).toEqual({ label: 'Sans échéance', tone: 'neutral' });
    expect(maintenanceStatus({ nextMaintenanceOn: '2026-11-10' }, '2026-11-13')).toEqual({ label: 'En retard, 3 j', tone: 'danger' });
    expect(maintenanceStatus({ nextMaintenanceOn: '2026-12-15' }, '2026-11-13')).toEqual({ label: 'Dans 32 j', tone: 'warning' });
    expect(maintenanceStatus({ nextMaintenanceOn: '2027-05-20' }, '2026-11-13')).toEqual({ label: 'À jour', tone: 'success' });
  });
});
