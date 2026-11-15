import { describe, expect, it } from 'vitest';
import { demoLeases } from '../../../baux/demo';
import { createDemoFinances } from '../../../finances/demo';
import { demoUnits } from '../../../locataires/demo';
import { buildCsv } from '../../analytique/csv';
import { MODELED_SLUG, REPORT_TYPES } from '../catalog';
import { REPORT_DEFINITIONS, findDefinition } from '../definitions';
import { createDemoLoyers } from '../demo';
import { LOYERS_DEFAULTS, buildLoyers } from '../loyers';
import { reportsDataSchema } from './data';
import { createDemoReportsData } from './demoData';
import { ALL, buildReport, decodeReportFilters, defaultFilters, encodeReportFilters, reportDataset, withoutZeroRows } from './engine';
import { paginate, paperLines } from '../GenericPaper';
import type { ReportFilters } from './types';

const data = reportsDataSchema.parse(createDemoReportsData());

function run(slug: string, patch: Partial<ReportFilters> = {}) {
  const definition = findDefinition(slug);
  if (!definition) throw new Error(`Définition absente : ${slug}`);
  return buildReport(definition, data, { ...defaultFilters(definition), ...patch });
}

const totalOf = (slug: string, columnId: string, patch: Partial<ReportFilters> = {}): number => {
  const view = run(slug, patch);
  const index = view.definition.columns.findIndex((column) => column.id === columnId);
  const cell = view.totals[index];
  if (typeof cell !== 'number') throw new Error(`Total absent : ${slug}.${columnId}`);
  return cell;
};

describe('catalogue et définitions', () => {
  it('définit chacun des 16 rapports encore sans écran, avec des lignes alignées sur les colonnes', () => {
    const expected = REPORT_TYPES.filter((report) => report.slug !== MODELED_SLUG).map((report) => report.slug);
    expect(expected).toHaveLength(16);
    expect(REPORT_DEFINITIONS.map((definition) => definition.slug).sort()).toEqual([...expected].sort());
    for (const definition of REPORT_DEFINITIONS) {
      const periods = definition.periods ?? [null];
      for (const period of periods) {
        for (const group of definition.groups) {
          const view = buildReport(definition, data, { ...defaultFilters(definition), period: period?.key ?? defaultFilters(definition).period, group: group.value });
          for (const row of view.rows) expect(row.cells).toHaveLength(definition.columns.length);
          expect(view.groups.flatMap((item) => item.rows)).toHaveLength(view.rows.length);
        }
      }
    }
  });

  it('produit des données et quatre indicateurs avec les réglages par défaut', () => {
    for (const definition of REPORT_DEFINITIONS) {
      const view = buildReport(definition, data, defaultFilters(definition));
      expect(view.hasData, definition.slug).toBe(true);
      expect(view.kpis, definition.slug).toHaveLength(4);
    }
  });
});

describe('cohérence avec les données des autres lots', () => {
  it('reprend les loyers appelés du rapport Loyers encaissés, bien par bien', () => {
    const reference = buildLoyers(createDemoLoyers(), LOYERS_DEFAULTS);
    const view = run('loyers-appeles');
    for (const row of reference.rows) {
      const mine = view.rows.find((item) => item.lotId === row.lot.id);
      expect(mine?.cells[6], row.lot.id).toBe(row.called);
    }
    expect(totalOf('loyers-appeles', 'called')).toBeGreaterThan(reference.totals.called);
  });

  it('retrouve le total impayé du rapport Loyers encaissés', () => {
    const reference = buildLoyers(createDemoLoyers(), LOYERS_DEFAULTS);
    expect(totalOf('loyers-impayes', 'due')).toBe(reference.totals.dueGross);
  });

  it('retrouve les soldes des baux', () => {
    const view = run('soldes-des-locataires');
    for (const lease of demoLeases.filter((item) => item.balance !== 0 && item.status !== 'termine')) {
      const row = view.rows.find((item) => item.lotId === lease.unitId);
      expect(row?.cells[5], lease.unitId).toBe(lease.balance);
    }
  });

  it('retrouve les dépôts de garantie, les lots, les dépenses et les prêts des autres écrans', () => {
    const finances = createDemoFinances();
    const held = demoLeases.filter((lease) => lease.status === 'en_cours' || lease.status === 'preavis').reduce((sum, lease) => sum + lease.deposit, 0);
    expect(totalOf('depots-de-garantie', 'held')).toBe(held);
    expect(run('etat-locatif').rows).toHaveLength(demoUnits.length);
    expect(totalOf('depenses-par-bien', 'amount')).toBe(finances.depenses.reduce((sum, expense) => sum + expense.montantTtc, 0));
    expect(totalOf('prets-immobiliers', 'remaining')).toBe(finances.prets.filter((loan) => !loan.supprime && loan.statut !== 'archive').reduce((sum, loan) => sum + loan.restantDu, 0));
    expect(run('revenus-fonciers').kpis[0]?.value.replace(/\u00a0/g, ' ')).toBe('20 900 €');
  });

  it('équilibre l’export comptable : appels, encaissements et dépenses', () => {
    const view = run('export-comptable');
    const journals = new Map<string, number>();
    for (const row of view.rows) journals.set(String(row.cells[1]), (journals.get(String(row.cells[1])) ?? 0) + Number(row.cells[6]));
    const called = data.payments.reduce((sum, payment) => sum + payment.called, 0);
    const collected = data.payments.reduce((sum, payment) => sum + payment.collected, 0);
    expect(journals.get('VT')).toBe(called);
    expect(journals.get('BQ')).toBe(collected);
    expect(journals.get('AC')).toBe(data.expenses.reduce((sum, expense) => sum + expense.amount, 0));
  });
});

describe('filtres, périodes et regroupements', () => {
  it('restreint par bien et par locataire', () => {
    expect(run('loyers-appeles', { lotId: 'apt-a1' }).rows).toHaveLength(1);
    expect(run('loyers-appeles', { tenantId: 'ibrahim-yao' }).rows[0]?.lotId).toBe('studio-2e');
    expect(run('loyers-appeles', { lotId: 'apt-a1', tenantId: 'ibrahim-yao' }).hasData).toBe(false);
    expect(run('prets-immobiliers', { lotId: 'apt-a1' }).rows).toHaveLength(3);
  });

  it('applique la période : aucune donnée en 2025, un seul mois en novembre', () => {
    expect(run('loyers-appeles', { period: 'year2025' }).hasData).toBe(false);
    const month = run('loyers-appeles', { period: 'month' });
    expect(month.rows.every((row) => row.cells[3] === 1)).toBe(true);
    expect(run('echeances-et-revisions', { period: 'next3' }).rows.length).toBeLessThan(run('echeances-et-revisions', { period: 'next12' }).rows.length);
  });

  it('regroupe par immeuble avec des sous-totaux qui retombent sur le total', () => {
    const view = run('loyers-appeles', { group: 'building' });
    expect(view.groups.length).toBeGreaterThan(1);
    const sum = view.groups.reduce((total, group) => total + Number(group.subtotals[6]), 0);
    expect(sum).toBe(Number(view.totals[6]));
    expect(run('loyers-appeles', { group: 'none' }).groups).toHaveLength(1);
  });

  it('masque les lignes à zéro', () => {
    const base = run('regularisation-des-charges');
    const trimmed = withoutZeroRows({ ...base, rows: base.rows.map((row, index) => (index === 0 ? { ...row, cells: row.cells.map((cell, position) => (position >= 3 ? 0 : cell)) } : row)) });
    expect(trimmed.rows).toHaveLength(base.rows.length - 1);
  });

  it('code et décode les filtres en retombant sur les valeurs par défaut', () => {
    const definition = findDefinition('loyers-impayes');
    if (!definition) throw new Error('définition absente');
    const filters = { period: 'month', lotId: 'apt-a1', tenantId: ALL, group: 'none' };
    expect(decodeReportFilters(definition, new URLSearchParams(encodeReportFilters(filters)))).toEqual(filters);
    expect(decodeReportFilters(definition, new URLSearchParams('periode=inconnue&groupe=zzz')).period).toBe('year2026');
    expect(decodeReportFilters(definition, new URLSearchParams('periode=next3')).period).toBe('year2026');
  });
});

describe('export CSV et pagination', () => {
  it('exporte les montants en décimales et ajoute la ligne Total', () => {
    const csv = buildCsv(reportDataset(run('loyers-appeles')));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('Total appelé');
    expect(lines.at(-1)).toMatch(/^Total;/);
    expect(lines.at(-1)).toContain('87540,00');
    expect(lines[1]).toContain('Koffi Adjovi');
  });

  it('neutralise les formules dans les cellules texte', () => {
    const view = run('loyers-appeles');
    const forged = { ...view, rows: view.rows.map((row, index) => (index === 0 ? { ...row, cells: ['=SOMME(A1)', ...row.cells.slice(1)] } : row)) };
    expect(buildCsv(reportDataset(forged))).toContain("'=SOMME(A1)");
  });

  it('répartit une ligne une seule fois sur les pages A4', () => {
    const view = run('export-comptable');
    const lines = paperLines(view);
    const pages = paginate(lines);
    expect(pages.length).toBeGreaterThan(5);
    expect(pages.flat()).toHaveLength(lines.length);
    expect(paginate(paperLines(run('prets-immobiliers')))).toHaveLength(1);
  });
});
