import { allocate } from '../allocate';
import { addMonths, monthRange } from '../months';
import type { AnalytiqueData, Forecast, ForecastBuilding } from '../schemas';
import { lotIdsInScope, monthFigures } from './aggregate';

export const HORIZONS = [6, 12, 24] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface ForecastOptions {
  horizon: Horizon;
  buildingId: string;
  irl: boolean;
  vacancy: boolean;
}

export interface ForecastMonth {
  month: string;
  loyers: number;
  autres: number;
  recurring: number;
  loan: number;
  oneOff: number;
  inflows: number;
  outflows: number;
  balance: number;
  cumulative: number;
}

export interface PastMonth {
  month: string;
  inflows: number;
  outflows: number;
}

export interface ForecastResult {
  months: ForecastMonth[];
  past: PastMonth[];
  openingCash: number;
  inflows: number;
  outflows: number;
  balance: number;
  closingCash: number;
  reference: { inflows: number; outflows: number; balance: number };
}

const roundEuros = (minor: number): number => Math.round(minor / 100) * 100;

function scaledDelta(delta: number, forecast: Forecast): number {
  return roundEuros((delta * forecast.irlBp) / forecast.referenceIrlBp);
}

function rentAt(building: ForecastBuilding, index: number, forecast: Forecast, options: ForecastOptions): number {
  const year = Math.floor(index / 12);
  const slot = index % 12;
  let rent = building.baseRent;
  if (options.irl) {
    const first = building.irl.map((step) => ({ index: step.index, delta: scaledDelta(step.delta, forecast) }));
    if (year === 0) {
      rent += first.filter((step) => step.index <= slot).reduce((acc, step) => acc + step.delta, 0);
    } else {
      rent += first.reduce((acc, step) => acc + step.delta, 0);
      rent += first
        .filter((step) => step.index <= slot)
        .reduce((acc, step) => acc + roundEuros((step.delta * (10000 + forecast.irlBp)) / 10000), 0);
    }
  }
  if (options.vacancy) {
    rent -= building.vacancies
      .filter((vacancy) => index >= vacancy.fromIndex && index <= vacancy.toIndex)
      .reduce((acc, vacancy) => acc + vacancy.rent, 0);
  }
  return rent;
}

const grown = (amount: number, year: number, growthBp: number): number =>
  year === 0 ? amount : roundEuros((amount * (10000 + growthBp)) / 10000);

export function buildForecast(data: AnalytiqueData, options: ForecastOptions): ForecastResult {
  const { forecast } = data;
  const selected = forecast.buildings.filter((building) => options.buildingId === 'all' || building.buildingId === options.buildingId);
  const weights = forecast.buildings.map((building) => building.oneOffWeight);
  const openingCash = selected.reduce((acc, building) => acc + building.openingCash, 0);
  const months: ForecastMonth[] = [];
  let cumulative = openingCash;
  for (let index = 0; index < options.horizon; index += 1) {
    const year = Math.floor(index / 12);
    const slot = index % 12;
    const oneOffTotal = grown(forecast.oneOff[slot] ?? 0, year, forecast.growthBp);
    const oneOffShares = allocate(oneOffTotal, weights);
    let loyers = 0;
    let autres = 0;
    let recurring = 0;
    let loan = 0;
    let oneOff = 0;
    forecast.buildings.forEach((building, position) => {
      if (!selected.includes(building)) return;
      loyers += rentAt(building, index, forecast, options);
      autres += building.other.filter((entry) => entry.index === slot).reduce((acc, entry) => acc + entry.amount, 0);
      recurring += grown(building.recurring, year, forecast.growthBp);
      loan += building.loan;
      oneOff += oneOffShares[position] ?? 0;
    });
    const inflows = loyers + autres;
    const outflows = recurring + loan + oneOff;
    const balance = inflows - outflows;
    cumulative += balance;
    months.push({ month: addMonths(forecast.startMonth, index), loyers, autres, recurring, loan, oneOff, inflows, outflows, balance, cumulative });
  }
  const scale = options.horizon / 12;
  const reference = selected.reduce(
    (acc, building) => ({
      inflows: acc.inflows + Math.round(building.reference.inflows * scale),
      outflows: acc.outflows + Math.round(building.reference.outflows * scale),
      balance: acc.balance + Math.round(building.reference.balance * scale),
    }),
    { inflows: 0, outflows: 0, balance: 0 },
  );
  const lotIds = lotIdsInScope(data, options.buildingId, 'all');
  const past = monthFigures(data, lotIds, monthRange(addMonths(forecast.startMonth, -3), addMonths(forecast.startMonth, -1))).map(
    (point) => ({ month: point.month, inflows: point.revenus, outflows: point.depenses }),
  );
  const inflows = months.reduce((acc, month) => acc + month.inflows, 0);
  const outflows = months.reduce((acc, month) => acc + month.outflows, 0);
  return {
    months,
    past,
    openingCash,
    inflows,
    outflows,
    balance: inflows - outflows,
    closingCash: cumulative,
    reference,
  };
}

export function lastDayOf(month: string): string {
  const [year = 0, mon = 1] = month.split('-').map(Number);
  const day = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${String(day).padStart(2, '0')}/${String(mon).padStart(2, '0')}/${String(year)}`;
}
