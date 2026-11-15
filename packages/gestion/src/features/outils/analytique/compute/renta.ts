import { addMonths, monthRange } from '../months';
import type { AnalytiqueData, Lot } from '../schemas';

export type RentaPeriod = '12m' | 'y2026' | 'y2025';

export const RENTA_PERIODS: Record<RentaPeriod, { from: string; to: string }> = {
  '12m': { from: '2025-12', to: '2026-11' },
  y2026: { from: '2026-01', to: '2026-11' },
  y2025: { from: '2025-01', to: '2025-12' },
};

export interface RentaRow {
  lot: Lot;
  buildingName: string;
  costPrice: number;
  rents: number;
  charges: number;
  loan: number;
  result: number;
  gross: number;
  net: number;
  rentedMonths: number;
  months: number;
}

export interface RentaTotals {
  costPrice: number;
  rents: number;
  charges: number;
  result: number;
  gross: number;
  net: number;
  rentedMonths: number;
  months: number;
  lots: number;
}

export interface RentaResult {
  rows: RentaRow[];
  totals: RentaTotals;
}

function rentaFor(
  data: AnalytiqueData,
  lotIds: ReadonlySet<string>,
  months: readonly string[],
  params: 'current' | 'previous',
  includeLoans: boolean,
): RentaResult {
  const statuses = new Map(data.occupancy.map((cell) => [`${cell.lotId}|${cell.month}`, cell.status]));
  const buildingNames = new Map(data.buildings.map((building) => [building.id, building.name]));
  const rows = data.lots
    .filter((lot) => lotIds.has(lot.id))
    .map((lot): RentaRow => {
      const source = params === 'current' ? lot : lot.previous;
      const rentedMonths = months.filter((month) => {
        const status = statuses.get(`${lot.id}|${month}`) ?? 'O';
        return status === 'O' || status === 'P';
      }).length;
      const rents = source.monthlyRent * rentedMonths;
      const charges = Math.round((source.annualCharges * months.length) / 12);
      const loan = includeLoans ? Math.round((lot.annualLoanInterest * months.length) / 12) : 0;
      const result = rents - charges - loan;
      const annualize = 12 / months.length;
      return {
        lot,
        buildingName: buildingNames.get(lot.buildingId) ?? '',
        costPrice: source.costPrice,
        rents,
        charges: charges + loan,
        loan,
        result,
        gross: source.costPrice > 0 ? (rents / source.costPrice) * annualize * 100 : 0,
        net: source.costPrice > 0 ? (result / source.costPrice) * annualize * 100 : 0,
        rentedMonths,
        months: months.length,
      };
    });
  const sum = (pick: (row: RentaRow) => number) => rows.reduce((acc, row) => acc + pick(row), 0);
  const costPrice = sum((row) => row.costPrice);
  const rents = sum((row) => row.rents);
  const result = sum((row) => row.result);
  const annualize = months.length === 0 ? 0 : 12 / months.length;
  return {
    rows,
    totals: {
      costPrice,
      rents,
      charges: sum((row) => row.charges),
      result,
      gross: costPrice > 0 ? (rents / costPrice) * annualize * 100 : 0,
      net: costPrice > 0 ? (result / costPrice) * annualize * 100 : 0,
      rentedMonths: sum((row) => row.rentedMonths),
      months: months.length * rows.length,
      lots: rows.length,
    },
  };
}

export interface RentaView {
  current: RentaResult;
  previous: RentaResult | null;
}

export function buildRenta(
  data: AnalytiqueData,
  lotIds: ReadonlySet<string>,
  period: RentaPeriod,
  includeLoans: boolean,
): RentaView {
  const range = RENTA_PERIODS[period];
  const months = monthRange(range.from, range.to);
  const current = rentaFor(data, lotIds, months, period === 'y2025' ? 'previous' : 'current', includeLoans);
  const previous =
    period === 'y2025' ? null : rentaFor(data, lotIds, months.map((month) => addMonths(month, -12)), 'previous', includeLoans);
  return { current, previous };
}

export function sortByNet(rows: readonly RentaRow[]): RentaRow[] {
  return [...rows].sort((a, b) => b.net - a.net || a.lot.name.localeCompare(b.lot.name, 'fr'));
}
