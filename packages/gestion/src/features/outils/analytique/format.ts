import { formatMoney } from '../../../format/money';
import { monthLongLowerLabel } from './months';

const NBSP = '\u00a0';

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value)
    .replace(/[\u202f\u00a0]/g, NBSP);
}

export function formatPercentValue(value: number, digits = 1): string {
  return `${formatDecimal(value, digits)}${NBSP}%`;
}

export function formatEuros(minor: number, options: { signed?: boolean } = {}): string {
  return formatMoney(minor, 'EUR', options).replace('-', '−');
}

export function formatWholeEuros(minor: number, options: { signed?: boolean } = {}): string {
  const major = Math.round(minor / 100);
  const text = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  })
    .format(major)
    .replace(/[\u202f\u00a0]/g, NBSP);
  return text.replace('-', '−');
}

export function formatRoundedEuros(minor: number, options: { signed?: boolean } = {}): string {
  return `${formatWholeEuros(minor, options)}${NBSP}€`;
}

export function ratioPercent(part: number, total: number): number {
  return total <= 0 ? 0 : (part / total) * 100;
}

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return roundTenth(((current - previous) / Math.abs(previous)) * 100);
}

export function formatStamp(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(date);
  return `${day}, ${time}`;
}

export function periodPhrase(period: '3m' | '12m' | 'year' | 'custom', from: string, to: string): string {
  switch (period) {
    case '3m':
      return 'sur les 3 derniers mois';
    case '12m':
      return 'sur 12 mois glissants';
    case 'year':
      return "sur l'année 2026";
    case 'custom':
      return `de ${monthLongLowerLabel(from)} à ${monthLongLowerLabel(to)}`;
  }
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}

export function formatDateFr(iso: string): string {
  const [year = '', month = '', day = ''] = iso.split('-');
  return `${day}/${month}/${year}`;
}
