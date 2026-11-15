import type { Cell, Dataset } from '../csv';
import { formatPercentValue, formatRoundedEuros } from '../format';
import type { AnalytiqueData } from '../schemas';
import { lotIdsInScope } from './aggregate';
import { percentDelta, pointsDelta } from './delta';
import type { Delta } from './delta';
import { buildRenta, sortByNet } from './renta';
import type { RentaPeriod, RentaRow, RentaTotals } from './renta';

export interface RentaFilters {
  period: RentaPeriod;
  buildingId: string;
  type: string;
  loans: boolean;
}

export const RENTA_DEFAULTS: RentaFilters = { period: '12m', buildingId: 'all', type: 'all', loans: false };

export type RentaSortKey = 'lot' | 'building' | 'cost' | 'rents' | 'charges' | 'result' | 'gross' | 'net' | 'months';

export interface RentaViewModel {
  rows: RentaRow[];
  totals: RentaTotals;
  kpis: {
    gross: { value: string; delta: Delta | null };
    net: { value: string; delta: Delta | null };
    result: { value: string; delta: Delta | null };
    weakest: { value: string; detail: string } | null;
  };
  hasData: boolean;
}

const sortValue = (row: RentaRow, key: RentaSortKey): number | string => {
  switch (key) {
    case 'lot':
      return row.lot.name;
    case 'building':
      return row.buildingName;
    case 'cost':
      return row.costPrice;
    case 'rents':
      return row.rents;
    case 'charges':
      return row.charges;
    case 'result':
      return row.result;
    case 'gross':
      return row.gross;
    case 'net':
      return row.net;
    case 'months':
      return row.rentedMonths;
  }
};

export function sortRows(rows: readonly RentaRow[], key: RentaSortKey, direction: 'asc' | 'desc'): RentaRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    const order = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right, 'fr') : Number(left) - Number(right);
    return order * factor || a.lot.name.localeCompare(b.lot.name, 'fr');
  });
}

export function buildRentaView(data: AnalytiqueData, filters: RentaFilters): RentaViewModel {
  const ids = lotIdsInScope(data, filters.buildingId, filters.type);
  const { current, previous } = buildRenta(data, ids, filters.period, filters.loans);
  const rows = sortByNet(current.rows);
  const weakest = rows.at(-1);
  return {
    rows,
    totals: current.totals,
    kpis: {
      gross: {
        value: formatPercentValue(current.totals.gross),
        delta: previous ? pointsDelta(current.totals.gross, previous.totals.gross, 'up', 1) : null,
      },
      net: {
        value: formatPercentValue(current.totals.net),
        delta: previous ? pointsDelta(current.totals.net, previous.totals.net, 'up', 1) : null,
      },
      result: {
        value: formatRoundedEuros(current.totals.result),
        delta: previous ? percentDelta(current.totals.result, previous.totals.result, 'up') : null,
      },
      weakest: weakest
        ? {
            value: `${weakest.lot.name}, ${formatPercentValue(weakest.net)}`,
            detail: `${String(weakest.rentedMonths)} mois loués sur ${String(weakest.months)}`,
          }
        : null,
    },
    hasData: rows.length > 0,
  };
}

export function rentaDataset(rows: readonly RentaRow[], totals: RentaTotals): Dataset {
  const body = rows.map((row): Cell[] => [
    row.lot.name,
    row.buildingName,
    { minor: row.costPrice },
    { minor: row.rents },
    { minor: -row.charges },
    { minor: row.result },
    Math.round(row.gross * 10) / 10,
    Math.round(row.net * 10) / 10,
    `${String(row.rentedMonths)} / ${String(row.months)}`,
  ]);
  const total: Cell[] = [
    'Total',
    `${String(totals.lots)} lots`,
    { minor: totals.costPrice },
    { minor: totals.rents },
    { minor: -totals.charges },
    { minor: totals.result },
    Math.round(totals.gross * 10) / 10,
    Math.round(totals.net * 10) / 10,
    totals.months === 0 ? '' : `${String(Math.round((totals.rentedMonths / totals.months) * 100))} %`,
  ];
  return {
    columns: ['Lot', 'Immeuble', 'Prix de revient', 'Loyers HC', 'Charges', 'Résultat', 'Rendement brut (%)', 'Rendement net (%)', 'Mois loués'],
    rows: [...body, total],
  };
}
