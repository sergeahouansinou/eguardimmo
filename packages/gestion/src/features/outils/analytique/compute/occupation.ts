import { DEMO_TODAY } from '../../kit/demoClock';
import type { OccupancyStatus } from '../constants';
import { AGE_BUCKETS, DAYS_PER_MONTH, WINDOW_END } from '../constants';
import type { AnalytiqueData, Arrears, LeaseEnd, Lot } from '../schemas';

export interface PlanningRow {
  lot: Lot;
  buildingName: string;
  cells: { month: string; status: OccupancyStatus; vacantDays: number | null }[];
  rented: number;
}

const DAY_MS = 86_400_000;

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function endOfMonth(month: string): string {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  const day = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function buildPlanning(data: AnalytiqueData, lotIds: ReadonlySet<string>, months: readonly string[]): PlanningRow[] {
  const statuses = new Map(data.occupancy.map((cell) => [`${cell.lotId}|${cell.month}`, cell.status]));
  const buildingNames = new Map(data.buildings.map((building) => [building.id, building.name]));
  const statusAt = (lotId: string, month: string): OccupancyStatus | undefined => statuses.get(`${lotId}|${month}`);
  return data.lots
    .filter((lot) => lotIds.has(lot.id))
    .map((lot) => {
      const cells = months.map((month) => {
        const status = statusAt(lot.id, month) ?? 'O';
        let vacantDays: number | null = null;
        if (status === 'V') {
          let start = month;
          for (;;) {
            const [year = 0, mon = 1] = start.split('-').map(Number);
            const before = `${String(mon === 1 ? year - 1 : year)}-${String(mon === 1 ? 12 : mon - 1).padStart(2, '0')}`;
            if (statusAt(lot.id, before) !== 'V') break;
            start = before;
          }
          const until = month === WINDOW_END ? DEMO_TODAY : endOfMonth(month);
          vacantDays = dayDiff(`${start}-01`, until);
        }
        return { month, status, vacantDays };
      });
      return {
        lot,
        buildingName: buildingNames.get(lot.buildingId) ?? '',
        cells,
        rented: cells.filter((cell) => cell.status === 'O' || cell.status === 'P').length,
      };
    });
}

export interface VacancyStats {
  lotMonths: number;
  days: number;
  unearned: number;
}

export function vacancyStats(rows: readonly PlanningRow[], worksAsVacancy: boolean): VacancyStats {
  let lotMonths = 0;
  let unearned = 0;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.status === 'V' || (worksAsVacancy && cell.status === 'T')) {
        lotMonths += 1;
        unearned += row.lot.monthlyRent;
      }
    }
  }
  return { lotMonths, days: Math.round(lotMonths * DAYS_PER_MONTH), unearned };
}

export interface LeaseEndRow extends LeaseEnd {
  lot: Lot;
  buildingName: string;
}

export function upcomingLeaseEnds(data: AnalytiqueData, lotIds: ReadonlySet<string>): LeaseEndRow[] {
  const lots = new Map(data.lots.map((lot) => [lot.id, lot]));
  const buildingNames = new Map(data.buildings.map((building) => [building.id, building.name]));
  return data.leaseEnds
    .filter((end) => lotIds.has(end.lotId) && end.date >= DEMO_TODAY)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((end) => {
      const lot = lots.get(end.lotId);
      return lot ? [{ ...end, lot, buildingName: buildingNames.get(lot.buildingId) ?? '' }] : [];
    });
}

export interface AgeBucket {
  id: (typeof AGE_BUCKETS)[number]['id'];
  label: string;
  amount: number;
}

export function arrearsByAge(arrears: readonly Arrears[]): AgeBucket[] {
  const buckets = AGE_BUCKETS.map((bucket) => ({ id: bucket.id, label: bucket.label, amount: 0 }));
  for (const entry of arrears) {
    const age = dayDiff(entry.dueSince, DEMO_TODAY);
    const index = AGE_BUCKETS.findIndex((bucket) => age <= bucket.max);
    const target = buckets[index === -1 ? buckets.length - 1 : index];
    if (target) target.amount += entry.amount;
  }
  return buckets;
}
