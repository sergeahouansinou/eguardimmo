import { describe, expect, it } from 'vitest';
import type { Attestation } from '@/data/schemas/logement';
import { insuranceView, periodStatus } from './insurance';

const attestation = (startOn: string, endOn: string): Attestation => ({
  id: `a-${startOn}`,
  label: 'Attestation',
  insurer: 'Mutuelle Horizon',
  contractNumber: 'HAB-0001',
  startOn,
  endOn,
  guarantees: 'Risques locatifs inclus',
  depositedOn: startOn,
  fileName: 'a.pdf',
});

describe('insuranceView', () => {
  it('signale l’absence d’attestation', () => {
    expect(insuranceView([], '2026-11-13')).toEqual({ current: null, status: 'aucune', daysLeft: null });
  });

  it('signale une attestation expirée quand aucune n’est en vigueur', () => {
    expect(insuranceView([attestation('2025-04-01', '2026-03-31')], '2026-11-13').status).toBe('expiree');
  });

  it('demande le renouvellement à moins de 180 jours de l’échéance', () => {
    const view = insuranceView([attestation('2026-04-01', '2027-03-31')], '2026-11-13');
    expect(view.status).toBe('a_renouveler');
    expect(view.daysLeft).toBe(138);
  });

  it('reste valide au-delà de la fenêtre de renouvellement', () => {
    expect(insuranceView([attestation('2026-04-01', '2027-03-31')], '2026-08-01').status).toBe('valide');
  });

  it('reste valide quand une attestation suivante a déjà été déposée', () => {
    const view = insuranceView([attestation('2026-04-01', '2027-03-31'), attestation('2027-04-01', '2028-03-31')], '2026-11-13');
    expect(view.status).toBe('valide');
  });
});

describe('periodStatus', () => {
  it('classe une période passée, en cours ou à venir', () => {
    expect(periodStatus(attestation('2025-04-01', '2026-03-31'), '2026-11-13')).toBe('expiree');
    expect(periodStatus(attestation('2026-04-01', '2027-03-31'), '2026-11-13')).toBe('en_vigueur');
    expect(periodStatus(attestation('2027-04-01', '2028-03-31'), '2026-11-13')).toBe('a_venir');
  });
});
