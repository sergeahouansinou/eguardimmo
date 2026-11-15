import { describe, expect, it } from 'vitest';
import { euros } from '../../kit/demoClock';
import { createDemoAnalytiqueData } from '../demo';
import { analytiqueDataSchema } from '../schemas';
import { DEFAULT_FILTERS, lotIdsInScope, monthFigures, periodMonths } from './aggregate';
import { buildForecast } from './forecast';
import { buildPlanning, vacancyStats } from './occupation';
import { buildRenta } from './renta';
import { buildRevDep } from './revdep';
import { buildVue } from './vue';

const data = createDemoAnalytiqueData();
const MONTHLY_REVENUE = [4620, 4650, 4650, 4700, 4700, 4840, 4840, 4790, 4880, 4880, 4830, 4180];
const MONTHLY_EXPENSES = [1180, 920, 1050, 2400, 980, 1100, 1020, 990, 1150, 3980, 1060, 1540];

describe('données de démonstration', () => {
  it('respectent le schéma Zod', () => {
    expect(() => analytiqueDataSchema.parse(data)).not.toThrow();
  });

  it('reproduisent les totaux mensuels de la maquette', () => {
    const view = buildVue(data, DEFAULT_FILTERS);
    expect(view.points.map((point) => point.revenus)).toEqual(MONTHLY_REVENUE.map(euros));
    expect(view.points.map((point) => point.depenses)).toEqual(MONTHLY_EXPENSES.map(euros));
  });

  it('reproduisent les revenus par immeuble', () => {
    const view = buildVue(data, DEFAULT_FILTERS);
    expect(Object.fromEntries(view.buildings.map((building) => [building.id, building.amount]))).toEqual({
      'les-tilleuls': euros(27140),
      'maison-riviere': euros(15360),
      'residence-du-parc': euros(14060),
    });
  });
});

describe('vue d’ensemble', () => {
  it('calcule les cartes sur 12 mois', () => {
    const view = buildVue(data, DEFAULT_FILTERS);
    const byId = Object.fromEntries(view.kpis.map((kpi) => [kpi.id, kpi]));
    expect(byId.revenus?.value).toBe('56 560 €');
    expect(byId.revenus?.delta?.text).toBe('4,1 %');
    expect(byId.depenses?.value).toBe('17 370 €');
    expect(byId.depenses?.delta).toMatchObject({ text: '9,8 %', tone: 'bad', direction: 'up' });
    expect(byId.cashflow?.value).toBe('39 190 €');
    expect(byId.occupation?.value).toBe('96 %');
    expect(byId.occupation?.delta).toMatchObject({ text: '2 pts', tone: 'bad', direction: 'down' });
    expect(byId.encaissement?.value).toBe('98 %');
    expect(byId.encaissement?.delta?.text).toBe('stable');
  });

  it('classe les catégories de dépenses et les impayés', () => {
    const view = buildVue(data, DEFAULT_FILTERS);
    expect(view.categories.map((category) => [category.label, category.amount / 100])).toEqual([
      ['Charges de copropriété', 4860],
      ['Travaux et réparations', 3920],
      ["Intérêts d'emprunt", 3180],
      ['Taxe foncière', 2840],
      ['Frais de gestion', 1330],
      ['Assurances', 1240],
    ]);
    expect(view.arrears.map((bucket) => bucket.amount)).toEqual([euros(1120), 0, 0, 0]);
    expect(view.arrearsTenants).toBe(3);
  });

  it('recalcule la vue selon la période, l’immeuble et le type de bien', () => {
    const threeMonths = buildVue(data, { ...DEFAULT_FILTERS, period: '3m' });
    expect(threeMonths.points).toHaveLength(3);
    const riviere = buildVue(data, { ...DEFAULT_FILTERS, buildingId: 'maison-riviere' });
    expect(riviere.kpis[0]?.value).toBe('15 360 €');
    const studios = buildVue(data, { ...DEFAULT_FILTERS, type: 'studio' });
    expect(Number(studios.kpis[0]?.spark.length)).toBe(12);
    const none = buildVue(data, { ...DEFAULT_FILTERS, buildingId: 'maison-riviere', type: 'studio' });
    expect(none.hasData).toBe(false);
  });

  it('borne une période personnalisée à la fenêtre de données', () => {
    expect(periodMonths('custom', '2026-05', '2026-07')).toEqual(['2026-05', '2026-06', '2026-07']);
    expect(periodMonths('custom', '2024-01', '2030-01')).toHaveLength(12);
  });
});

describe('revenus et dépenses', () => {
  it('reproduit les sources de revenus et les provisions', () => {
    const view = buildRevDep(data, { ...DEFAULT_FILTERS, compare: true });
    expect(view.sources.map((source) => source.amount / 100)).toEqual([48920, 7160, 480]);
    expect(view.recoverable.map((entry) => entry.amount / 100)).toEqual([5120, 12250]);
    expect(view.provisions).toBe(euros(2040));
    expect(view.kpis[0]?.previousText).toBe('N-1 : 54 350 €');
    expect(view.kpis[1]?.previousText).toBe('N-1 : 15 820 €');
    expect(view.kpis[3]?.value).toBe('30,7 %');
  });

  it('reproduit la matrice catégories par mois', () => {
    const view = buildRevDep(data, DEFAULT_FILTERS);
    const taxe = view.heatRows.find((row) => row.id === 'taxe-fonciere');
    expect(taxe?.cells.map((cell) => cell / 100)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 2840, 0, 0]);
    expect(view.heatTotals.map((cell) => cell / 100)).toEqual(MONTHLY_EXPENSES);
  });
});

describe('prévisionnel', () => {
  const base = { horizon: 12 as const, buildingId: 'all', irl: true, vacancy: true };

  it('reproduit le détail mensuel de la maquette', () => {
    const result = buildForecast(data, base);
    expect(result.months.map((month) => month.loyers / 100)).toEqual([4560, 4560, 4950, 4950, 4950, 4980, 5020, 5020, 5020, 5020, 5020, 5070]);
    expect(result.months.map((month) => month.balance / 100)).toEqual([2800, 2860, 3220, 3070, 3200, 3180, 3300, 3170, 3280, 940, 3260, 3290]);
    expect(result.months.at(-1)?.cumulative).toBe(euros(43770));
    expect(result.inflows).toBe(euros(59240));
    expect(result.outflows).toBe(euros(23670));
    expect(result.balance).toBe(euros(35570));
    expect(result.openingCash).toBe(euros(8200));
  });

  it('ignore l’indexation et la vacance quand elles sont désactivées', () => {
    const result = buildForecast(data, { ...base, irl: false, vacancy: false });
    expect(new Set(result.months.map((month) => month.loyers))).toEqual(new Set([euros(4950)]));
  });

  it('couvre 6 et 24 mois et filtre par immeuble', () => {
    expect(buildForecast(data, { ...base, horizon: 6 }).months).toHaveLength(6);
    expect(buildForecast(data, { ...base, horizon: 24 }).months).toHaveLength(24);
    const parc = buildForecast(data, { ...base, buildingId: 'residence-du-parc' });
    expect(parc.months[0]?.loyers).toBe(euros(1210));
    expect(parc.openingCash).toBe(euros(1800));
  });

  it('recalcule l’indexation avec le taux d’hypothèse', () => {
    const lowered = buildForecast({ ...data, forecast: { ...data.forecast, irlBp: 0 } }, base);
    expect(lowered.months[5]?.loyers).toBe(euros(4950));
  });

  it('conserve les mois réalisés précédant la projection', () => {
    const result = buildForecast(data, base);
    expect(result.past.map((point) => point.inflows / 100)).toEqual([4880, 4830, 4180]);
  });
});

describe('occupation', () => {
  it('calcule l’occupation actuelle et la vacance', () => {
    const ids = lotIdsInScope(data, 'all', 'all');
    const months = periodMonths('12m', '', '');
    const points = monthFigures(data, ids, months);
    expect(points.at(-1)).toMatchObject({ rented: 10, lots: 11 });
    const rows = buildPlanning(data, ids, months);
    expect(vacancyStats(rows, true)).toEqual({ lotMonths: 5, days: 152, unearned: euros(3050) });
    expect(vacancyStats(rows, false).lotMonths).toBe(3);
    const studio = rows.find((row) => row.lot.id === 'studio-1er');
    expect(studio?.rented).toBe(7);
    expect(studio?.cells.at(-1)?.vacantDays).toBe(43);
  });
});

describe('rentabilité', () => {
  it('reproduit les totaux et les rendements de la maquette', () => {
    const { current, previous } = buildRenta(data, lotIdsInScope(data, 'all', 'all'), '12m', false);
    expect(current.totals).toMatchObject({
      costPrice: euros(1113000),
      rents: euros(69430),
      charges: euros(18920),
      result: euros(50510),
    });
    expect(current.totals.gross.toFixed(1)).toBe('6.2');
    expect(current.totals.net.toFixed(1)).toBe('4.5');
    const cave = current.rows.find((row) => row.lot.id === 'cave-c2');
    expect(cave?.net.toFixed(1)).toBe('7.6');
    expect(previous?.totals.gross.toFixed(1)).toBe('6.0');
    expect(previous?.totals.net.toFixed(1)).toBe('4.6');
  });

  it('déduit les emprunts quand l’option est active', () => {
    const without = buildRenta(data, lotIdsInScope(data, 'all', 'all'), '12m', false).current.totals.result;
    const withLoans = buildRenta(data, lotIdsInScope(data, 'all', 'all'), '12m', true).current.totals.result;
    expect(without - withLoans).toBe(euros(3180));
  });

  it('n’expose pas de comparaison pour l’année 2025', () => {
    expect(buildRenta(data, lotIdsInScope(data, 'all', 'all'), 'y2025', false).previous).toBeNull();
  });
});
