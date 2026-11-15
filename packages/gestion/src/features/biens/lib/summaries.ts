import type { Tone } from '@eguardimmo/shell';
import { daysBetween, formatDate, formatDuration, formatMonthYear } from './dates';
import type { EquipementRow } from '../schemas/equipements';
import type { Diagnostic, Period } from '../schemas/lots';

export function diagnosticSummary(item: Diagnostic): string {
  if (item.status === 'sans_objet') return item.result;
  if (item.status === 'expire' && item.expiresOn) return `Expiré le ${formatDate(item.expiresOn)}`;
  if (item.status === 'a_refaire' && item.expiresNote) return `À refaire ${item.expiresNote.toLowerCase().replace(/^prochain bail$/, 'au prochain bail')}`;
  if (item.expiresOn) return `${item.result}, valide jusqu’au ${formatDate(item.expiresOn)}`;
  return item.result;
}

export function periodStatus(period: Period): { label: string; tone: Tone } | null {
  if (period.status === 'en_cours') return { label: 'En cours', tone: 'success' };
  if (period.status === 'preavis') return { label: 'Préavis', tone: 'warning' };
  if (period.status === 'termine') return { label: 'Terminé', tone: 'neutral' };
  return null;
}

export function periodRange(period: Period): string {
  if (period.endDate === null) return `${formatDate(period.startDate)} → en cours`;
  return `${formatDate(period.startDate)} → ${formatDate(period.endDate)}`;
}

export function periodDetail(period: Period, asOf: string): string {
  const end = period.endDate ?? asOf;
  const duration = formatDuration(period.startDate, end);
  if (period.kind === 'vacance') return [`Vacance, ${duration}`, period.note].filter(Boolean).join(' · ');
  const range = period.endDate === null ? `Depuis le ${formatDate(period.startDate)}` : `${formatDate(period.startDate)} au ${formatDate(period.endDate)}`;
  const suffix = period.status === 'en_cours' ? 'bail en cours' : period.status === 'preavis' && period.noticeEndsOn ? `préavis jusqu’au ${formatDate(period.noticeEndsOn)}` : period.exitNote;
  return [range, duration, suffix].filter(Boolean).join(' · ');
}

export function warrantyLabel(row: Pick<EquipementRow, 'warrantyEndsOn'>, asOf: string): { label: string; tone: Tone } {
  if (row.warrantyEndsOn === null) return { label: 'Non renseignée', tone: 'neutral' };
  if (row.warrantyEndsOn < asOf) return { label: `Expirée le ${formatDate(row.warrantyEndsOn)}`, tone: 'neutral' };
  return { label: `Jusqu’au ${formatDate(row.warrantyEndsOn)}`, tone: 'info' };
}

export function equipementLine(row: EquipementRow, asOf: string): string {
  const parts: string[] = [];
  if (row.room) parts.push(row.room);
  if (row.warrantyEndsOn !== null) parts.push(row.warrantyEndsOn >= asOf ? `garantie jusqu’au ${formatDate(row.warrantyEndsOn)}` : 'garantie expirée');
  if (row.nextMaintenanceOn !== null) parts.push(`entretien ${formatMonthYear(row.nextMaintenanceOn)}`);
  return parts.join(' · ');
}

export const UPCOMING_WINDOW_DAYS = 60;

export function maintenanceStatus(row: Pick<EquipementRow, 'nextMaintenanceOn'>, asOf: string): { label: string; tone: Tone } {
  if (row.nextMaintenanceOn === null) return { label: 'Sans échéance', tone: 'neutral' };
  const days = daysBetween(asOf, row.nextMaintenanceOn);
  if (days < 0) return { label: `En retard, ${String(-days)} j`, tone: 'danger' };
  if (days <= UPCOMING_WINDOW_DAYS) return { label: `Dans ${String(days)} j`, tone: 'warning' };
  return { label: 'À jour', tone: 'success' };
}
