import type { BadgeTone } from '@eguardimmo/ui';
import { daysBetween, formatDateFr } from '../locataires/kit/dates';
import type { Certificate, CertificateState, SubjectType } from './model';

export const stateBadge: Record<CertificateState, { label: string; tone: BadgeTone }> = {
  valid: { label: 'Valide', tone: 'success' },
  to_renew: { label: 'À renouveler', tone: 'warning' },
  expired: { label: 'Expirée', tone: 'danger' },
};

export const stateFilterLabel: Record<CertificateState, string> = {
  valid: 'Valides',
  to_renew: 'À renouveler',
  expired: 'Expirées',
};

export const subjectTypeLabel: Record<SubjectType, string> = {
  organization: 'Organisation',
  unit: 'Lot',
  party: 'Tiers',
  equipment: 'Équipement',
  lease: 'Bail',
};

const STATE_RANK: Record<CertificateState, number> = { expired: 0, to_renew: 1, valid: 2 };

export function byUrgency(a: Certificate, b: Certificate): number {
  if (STATE_RANK[a.state] !== STATE_RANK[b.state]) return STATE_RANK[a.state] - STATE_RANK[b.state];
  if (a.expiresOn === b.expiresOn) return 0;
  if (a.expiresOn === null) return 1;
  if (b.expiresOn === null) return -1;
  return a.expiresOn < b.expiresOn ? -1 : 1;
}

export function remainingLabel(certificate: Pick<Certificate, 'expiresOn' | 'state'>, today: string): string {
  if (certificate.expiresOn === null) return 'Sans échéance';
  const days = daysBetween(today, certificate.expiresOn);
  if (days < 0) return `Échue depuis ${String(-days)} j`;
  if (days === 0) return 'Échéance aujourd’hui';
  return `Dans ${String(days)} j`;
}

export const expiryText = (expiresOn: string | null): string => (expiresOn === null ? 'Sans échéance' : formatDateFr(expiresOn));

export const valueFieldLabel: Readonly<Record<string, string>> = {
  energy_class: 'Classe énergétique',
  ghg_class: 'Classe climat (émissions de gaz à effet de serre)',
  guaranteed_amount: 'Montant garanti',
};

export function fieldLabel(key: string): string {
  const known = valueFieldLabel[key];
  if (known) return known;
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
