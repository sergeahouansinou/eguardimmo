import { addDays, daysBetween } from '@/lib/dates';
import type { Attestation } from '@/data/schemas/logement';

export const RENEWAL_WINDOW_DAYS = 180;

export interface InsuranceView {
  current: Attestation | null;
  status: 'valide' | 'a_renouveler' | 'expiree' | 'aucune';
  daysLeft: number | null;
}

export function insuranceView(attestations: readonly Attestation[], today: string): InsuranceView {
  const inForce = attestations
    .filter((item) => item.startOn <= today && item.endOn >= today)
    .sort((a, b) => b.endOn.localeCompare(a.endOn));
  const current = inForce[0] ?? null;
  if (!current) return { current: null, status: attestations.length === 0 ? 'aucune' : 'expiree', daysLeft: null };
  const daysLeft = daysBetween(today, current.endOn);
  const renewed = attestations.some((item) => item.startOn <= addDays(current.endOn, 1) && item.endOn > current.endOn);
  const status = !renewed && daysLeft <= RENEWAL_WINDOW_DAYS ? 'a_renouveler' : 'valide';
  return { current, status, daysLeft };
}

export type AttestationPeriodStatus = 'en_vigueur' | 'a_venir' | 'expiree';

export function periodStatus(item: Attestation, today: string): AttestationPeriodStatus {
  if (item.endOn < today) return 'expiree';
  if (item.startOn > today) return 'a_venir';
  return 'en_vigueur';
}
