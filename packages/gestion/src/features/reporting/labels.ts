import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import type { AgingBucket, DatePeriod, LineKind, Money, PeriodKind, ReportStatus, Section } from './model';

export const moneyText = (value: Money): string => formatMoney(value.amount, value.currency);

export const plural = (count: number, one: string, many: string): string => `${String(count)} ${count > 1 ? many : one}`;

export const statusBadge: Record<ReportStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'warning' },
  generated: { label: 'Généré', tone: 'info' },
  published: { label: 'Publié', tone: 'success' },
  superseded: { label: 'Remplacé', tone: 'neutral' },
  discarded: { label: 'Écarté', tone: 'neutral' },
};

export const periodKindLabel: Record<PeriodKind, string> = { monthly: 'Mensuel', quarterly: 'Trimestriel', custom: 'Personnalisé' };

export const sectionLabel: Record<Section, string> = {
  rent: 'Loyers et charges par lot',
  fees: 'Honoraires et TVA',
  payout: 'Compte du mandant et reversements',
  arrears: 'Impayés en cours',
  works: 'Travaux imputés',
  receipts: 'Liste des quittances',
};

export const lineKindLabel: Record<LineKind, string> = {
  rent_called: 'Loyer et charges appelés',
  rent_collected: 'Loyer et charges encaissés',
  advance: 'Avance sur loyer',
  fee: 'Honoraires HT',
  fee_vat: 'TVA sur honoraires',
  works: 'Travaux',
  payout: 'Reversement',
  adjustment: 'Régularisation',
  arrears: 'Reste dû',
};

export const agingLabel: Record<AgingBucket, string> = {
  '0_30': '0 à 30 jours',
  '31_60': '31 à 60 jours',
  '61_90': '61 à 90 jours',
  over_90: 'Plus de 90 jours',
};

export function rateText(basisPoints: number | null): string {
  if (basisPoints === null) return '—';
  const whole = Math.trunc(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, '0').replace(/0+$/, '');
  return `${fraction === '' ? String(whole) : `${String(whole)},${fraction}`} %`;
}

const monthEnd = (month: string): string => {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};

export function periodText(period: DatePeriod): string {
  const month = period.start.slice(0, 7);
  if (period.start === `${month}-01` && period.end === monthEnd(month)) return monthLabel(month);
  return `du ${formatDateFr(period.start)} au ${formatDateFr(period.end)}`;
}

export const dayTime = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso));
