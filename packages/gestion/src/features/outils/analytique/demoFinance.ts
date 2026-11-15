import { euros } from '../kit/demoClock';
import { allocate, fitTotal } from './allocate';
import type { ExpenseCategoryId } from './constants';
import { EXPENSE_CATEGORIES } from './constants';
import { ARREARS, BUILDINGS, CURRENT_MONTHS, LOTS, OCCUPANCY, PREVIOUS_MONTHS, PREVIOUS_SHORTFALL } from './demoBase';
import type { Expense, Revenue } from './schemas';

const BUILDING_REVENUE: readonly (readonly number[])[] = [
  [2418, 2434, 2434, 2116, 2116, 2178, 2178, 2156, 2197, 2197, 2528, 2188],
  [1369, 1378, 1378, 1197, 1197, 1233, 1233, 1220, 1243, 1243, 1431, 1238],
  [833, 838, 838, 1387, 1387, 1429, 1429, 1414, 1440, 1440, 871, 754],
];

const PREVIOUS_REVENUE = [4420, 4450, 4450, 4500, 4500, 4640, 4650, 4600, 4690, 4690, 4640, 4120];

const CHARGES_TOTAL = 7160;
const OTHER_PER_MONTH = 40;

const EXPENSE_MATRIX: Record<ExpenseCategoryId, readonly number[]> = {
  copropriete: [405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405],
  travaux: [400, 140, 270, 380, 200, 320, 239, 209, 369, 358, 278, 757],
  interets: [265, 265, 265, 265, 265, 265, 265, 265, 265, 265, 265, 265],
  'taxe-fonciere': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2840, 0, 0],
  gestion: [110, 110, 110, 110, 110, 110, 111, 111, 111, 112, 112, 113],
  assurances: [0, 0, 0, 1240, 0, 0, 0, 0, 0, 0, 0, 0],
};

const RECOVERABLE_TRAVAUX: Record<number, number> = { 1: 140, 2: 120 };
const PREVIOUS_EXPENSES_TOTAL = 15820;

const lotIds = LOTS.map((lot) => lot.id);

function statusOf(): Map<string, string> {
  return new Map(OCCUPANCY.map((cell) => [`${cell.lotId}|${cell.month}`, cell.status]));
}

const COPROPRIETE_WEIGHTS: Record<string, number> = {
  'apt-a1': 12,
  'apt-a2': 12,
  'apt-b1': 12,
  'studio-b3': 8,
  'parking-p4': 2,
  'studio-2e': 8,
  'studio-1er': 8,
  'cave-c2': 1,
};

const WORKS_WEIGHTS = { appartement: 3, studio: 2, maison: 3, stationnement: 0, cave: 0 } as const;

function expenseWeights(category: ExpenseCategoryId): number[] {
  switch (category) {
    case 'copropriete':
      return LOTS.map((lot) => COPROPRIETE_WEIGHTS[lot.id] ?? 0);
    case 'travaux':
      return LOTS.map((lot) => WORKS_WEIGHTS[lot.type]);
    case 'interets':
      return LOTS.map((lot) => lot.annualLoanInterest);
    case 'gestion':
      return LOTS.map((lot) => lot.monthlyRent);
    default:
      return LOTS.map((lot) => lot.costPrice);
  }
}

export function buildRevenues(): Revenue[] {
  const status = statusOf();
  const buildingTotals = BUILDING_REVENUE.map((row) => row.reduce((acc, value) => acc + value, 0));
  const periods = [
    {
      months: CURRENT_MONTHS,
      cells: BUILDING_REVENUE.map((row) => [...row]),
      exactCharges: true,
      withOther: true,
    },
    {
      months: PREVIOUS_MONTHS,
      cells: BUILDINGS.map(() => [] as number[]),
      exactCharges: false,
      withOther: false,
    },
  ];
  PREVIOUS_REVENUE.forEach((total) => {
    allocate(total, buildingTotals).forEach((value, buildingIndex) => {
      periods[1]?.cells[buildingIndex]?.push(value);
    });
  });

  const records: Revenue[] = [];
  for (const period of periods) {
    const flat = period.cells.flat();
    const rough = flat.map((value) => Math.round((value * CHARGES_TOTAL) / 56560));
    const charges = period.exactCharges ? fitTotal(rough, CHARGES_TOTAL) : rough;
    period.months.forEach((month, monthIndex) => {
      BUILDINGS.forEach((building, buildingIndex) => {
        const total = period.cells[buildingIndex]?.[monthIndex] ?? 0;
        const chargesCell = charges[buildingIndex * period.months.length + monthIndex] ?? 0;
        const other = period.withOther && buildingIndex === 0 ? OTHER_PER_MONTH : 0;
        const lots = LOTS.filter((lot) => lot.buildingId === building.id);
        const weights = lots.map((lot) => {
          const st = status.get(`${lot.id}|${month}`);
          return st === 'O' || st === 'P' ? lot.monthlyRent : 0;
        });
        const loyers = allocate(euros(total - chargesCell - other), weights);
        const chargesParts = allocate(euros(chargesCell), weights);
        const otherParts = allocate(euros(other), weights);
        lots.forEach((lot, lotIndex) => {
          const collected = (loyers[lotIndex] ?? 0) + (chargesParts[lotIndex] ?? 0) + (otherParts[lotIndex] ?? 0);
          const arrears = ARREARS.find((entry) => entry.lotId === lot.id && month === '2026-11')?.amount ?? 0;
          const shortfall =
            PREVIOUS_SHORTFALL.lotId === lot.id && PREVIOUS_SHORTFALL.month === month ? PREVIOUS_SHORTFALL.amount : 0;
          records.push({
            lotId: lot.id,
            month,
            loyers: loyers[lotIndex] ?? 0,
            charges: chargesParts[lotIndex] ?? 0,
            autres: otherParts[lotIndex] ?? 0,
            called: collected + arrears + shortfall,
          });
        });
      });
    });
  }
  return records;
}

export function buildExpenses(): Expense[] {
  const records: Expense[] = [];
  const previousScale = PREVIOUS_EXPENSES_TOTAL / 17370;
  const flatPrevious = fitTotal(
    EXPENSE_CATEGORIES.flatMap((category) => EXPENSE_MATRIX[category.id].map((value) => Math.round(value * previousScale))),
    PREVIOUS_EXPENSES_TOTAL,
  );
  EXPENSE_CATEGORIES.forEach((category, categoryIndex) => {
    const weights = expenseWeights(category.id);
    const row = EXPENSE_MATRIX[category.id];
    const push = (months: readonly string[], amounts: readonly number[], recoverableOf: (index: number, amount: number) => number) => {
      months.forEach((month, monthIndex) => {
        const amount = amounts[monthIndex] ?? 0;
        if (amount === 0) return;
        const parts = allocate(euros(amount), weights);
        const recoverableParts = allocate(euros(recoverableOf(monthIndex, amount)), weights);
        lotIds.forEach((lotId, lotIndex) => {
          const part = parts[lotIndex] ?? 0;
          if (part === 0) return;
          records.push({ lotId, month, category: category.id, amount: part, recoverable: recoverableParts[lotIndex] ?? 0 });
        });
      });
    };
    const recoverableCurrent = (index: number, amount: number) => {
      if (category.id === 'copropriete') return amount;
      if (category.id === 'travaux') return RECOVERABLE_TRAVAUX[index] ?? 0;
      return 0;
    };
    push(CURRENT_MONTHS, row, recoverableCurrent);
    const previousRow = flatPrevious.slice(categoryIndex * 12, categoryIndex * 12 + 12);
    push(PREVIOUS_MONTHS, previousRow, (index, amount) =>
      category.id === 'copropriete' ? amount : category.id === 'travaux' ? Math.round((RECOVERABLE_TRAVAUX[index] ?? 0) * previousScale) : 0,
    );
  });
  return records;
}
