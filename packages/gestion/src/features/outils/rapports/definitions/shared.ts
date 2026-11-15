import type { ReportsData } from '../engine/data';
import type { GroupOption, PeriodSpec, ReportCell, ReportRow } from '../engine/types';
import { monthInPeriod } from '../engine/periods';

export const GROUP_NONE: GroupOption = { value: 'none', label: 'Regrouper par : Aucun', attr: null };
export const GROUP_BUILDING: GroupOption = { value: 'building', label: 'Regrouper par : Immeuble', attr: 'building' };

type Lot = ReportsData['lots'][number];
type Lease = ReportsData['leases'][number];

export function lotIndex(data: ReportsData): ReadonlyMap<string, Lot> {
  return new Map(data.lots.map((lot) => [lot.id, lot]));
}

export const buildingOf = (lots: ReadonlyMap<string, Lot>, lotId: string): string => lots.get(lotId)?.buildingName ?? 'Autres';
export const lotNameOf = (lots: ReadonlyMap<string, Lot>, lotId: string): string => lots.get(lotId)?.name ?? lotId;

export const isCurrent = (lease: Lease): boolean => lease.status === 'en_cours' || lease.status === 'preavis';

export function leasePayments(data: ReportsData, lease: Lease, period: PeriodSpec): ReportsData['payments'] {
  const last = data.today.slice(0, 7);
  return data.payments.filter(
    (payment) => payment.lotId === lease.lotId && monthInPeriod(payment.month, period) && payment.month >= lease.start.slice(0, 7) && payment.month <= last,
  );
}

export const total = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function makeRow(
  id: string,
  ids: { lotId?: string | null; tenantId?: string | null },
  attrs: Record<string, string>,
  cells: readonly ReportCell[],
  tone?: ReportRow['tone'],
): ReportRow {
  return { id, lotId: ids.lotId ?? null, tenantId: ids.tenantId ?? null, attrs, cells, ...(tone ? { tone } : {}) };
}

export function ratio(part: number, whole: number): number {
  return whole <= 0 ? 0 : (part / whole) * 100;
}
