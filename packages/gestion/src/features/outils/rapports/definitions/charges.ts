import { formatEuros, formatRoundedEuros, plural } from '../../analytique/format';
import { indexOfColumns, sumAt } from '../engine/engine';
import { PAST_PERIODS, inPeriod } from '../engine/periods';
import type { ReportDefinition } from '../engine/types';
import { GROUP_BUILDING, GROUP_NONE, buildingOf, isCurrent, leasePayments, lotIndex, lotNameOf, makeRow } from './shared';

const DEPENSES_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'date', label: 'Date', kind: 'date' },
  { id: 'kind', label: 'Catégorie', kind: 'text' },
  { id: 'supplier', label: 'Fournisseur', kind: 'text' },
  { id: 'description', label: 'Description', kind: 'text' },
  { id: 'amount', label: 'Montant TTC', kind: 'cents', total: 'sum' },
] as const;
const depenses = indexOfColumns(DEPENSES_COLUMNS);

export const depensesParBien: ReportDefinition = {
  slug: 'depenses-par-bien',
  title: 'DÉPENSES PAR BIEN',
  description: 'Travaux, taxes, assurances et entretien enregistrés sur la période.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: false },
  groups: [GROUP_BUILDING, { value: 'kind', label: 'Regrouper par : Catégorie', attr: 'kind' }, GROUP_NONE],
  columns: DEPENSES_COLUMNS,
  emptyHint: 'Aucune dépense n’a été enregistrée sur cette période pour ce périmètre.',
  rows: ({ data, period }) =>
    data.expenses
      .filter((expense) => inPeriod(expense.date, period))
      .map((expense) => {
        const lot = data.lots.find((item) => item.name === expense.lotName && item.buildingName === expense.buildingName);
        return makeRow(
          expense.id,
          { lotId: lot?.id ?? null },
          { building: expense.buildingName, kind: expense.kind },
          [expense.buildingName, expense.lotName, expense.date, expense.kind, expense.supplier, expense.description, expense.amount],
        );
      })
      .sort((a, b) => String(b.cells[depenses('date')]).localeCompare(String(a.cells[depenses('date')]))),
  kpis: (rows) => {
    const kinds = new Map<string, number>();
    for (const row of rows) kinds.set(String(row.cells[depenses('kind')]), (kinds.get(String(row.cells[depenses('kind')])) ?? 0) + Number(row.cells[depenses('amount')]));
    const top = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0];
    return [
      { label: 'Total des dépenses', value: formatEuros(sumAt(rows, depenses('amount'))) },
      { label: 'Nombre de dépenses', value: String(rows.length) },
      { label: 'Premier poste', value: top ? top[0] : '–', caption: top ? formatEuros(top[1]) : undefined },
      { label: 'Biens concernés', value: String(new Set(rows.map((row) => row.cells[depenses('lot')])).size) },
    ];
  },
};

const REGUL_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'provisions', label: 'Provisions appelées', kind: 'money', total: 'sum' },
  { id: 'real', label: 'Dépenses réelles', kind: 'money', total: 'sum' },
  { id: 'balance', label: 'Solde', kind: 'money', total: 'sum' },
] as const;
const regul = indexOfColumns(REGUL_COLUMNS);

export const regularisationCharges: ReportDefinition = {
  slug: 'regularisation-des-charges',
  title: 'RÉGULARISATION DES CHARGES',
  description: 'Provisions appelées comparées aux dépenses réelles de chaque bien.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: REGUL_COLUMNS,
  note: 'Un solde positif est à restituer au locataire, un solde négatif lui est à réclamer. Les dépenses retenues sont celles enregistrées sur le bien.',
  emptyHint: 'Aucune provision de charges n’a été appelée sur cette période.',
  rows: ({ data, period }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const months = leasePayments(data, lease, period).length;
      if (months === 0) return [];
      const name = lotNameOf(lots, lease.lotId);
      const real = data.expenses.filter((expense) => expense.lotName === name && inPeriod(expense.date, period)).reduce((sum, expense) => sum + expense.amount, 0);
      const provisions = lease.charges * months;
      return [
        makeRow(
          lease.lotId,
          { lotId: lease.lotId, tenantId: lease.tenantId },
          { building: buildingOf(lots, lease.lotId) },
          [buildingOf(lots, lease.lotId), name, lease.tenantName, provisions, real, provisions - real],
        ),
      ];
    });
  },
  kpis: (rows) => [
    { label: 'Provisions appelées', value: formatRoundedEuros(sumAt(rows, regul('provisions'))) },
    { label: 'Dépenses réelles', value: formatRoundedEuros(sumAt(rows, regul('real'))) },
    { label: 'Solde à restituer', value: formatRoundedEuros(sumAt(rows, regul('balance'))) },
    { label: 'Baux concernés', value: plural(rows.length, 'bail', 'baux') },
  ],
};

const DEPOTS_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'receivedOn', label: 'Reçu le', kind: 'date' },
  { id: 'deposit', label: 'Dépôt de garantie', kind: 'money', total: 'sum' },
  { id: 'retained', label: 'Retenues', kind: 'money', total: 'sum' },
  { id: 'returned', label: 'Restitué', kind: 'money', total: 'sum' },
  { id: 'held', label: 'Détenu', kind: 'money', total: 'sum' },
  { id: 'situation', label: 'Situation', kind: 'text' },
] as const;
const depots = indexOfColumns(DEPOTS_COLUMNS);

export const depotsGarantie: ReportDefinition = {
  slug: 'depots-de-garantie',
  title: 'DÉPÔTS DE GARANTIE',
  description: 'Dépôts reçus, retenues et restitutions, par bail.',
  periods: null,
  filters: { lot: true, tenant: true },
  groups: [GROUP_NONE, GROUP_BUILDING, { value: 'situation', label: 'Regrouper par : Situation', attr: 'situation' }],
  columns: DEPOTS_COLUMNS,
  emptyHint: 'Aucun dépôt de garantie ne correspond à ce périmètre.',
  rows: ({ data }) => {
    const lots = lotIndex(data);
    const held = data.leases
      .filter((lease) => lease.status !== 'a_venir')
      .map((lease) => {
        const situation = lease.status === 'preavis' ? 'Détenu, bail en préavis' : 'Détenu';
        return makeRow(
          `bail-${lease.lotId}`,
          { lotId: lease.lotId, tenantId: lease.tenantId },
          { building: buildingOf(lots, lease.lotId), situation },
          [buildingOf(lots, lease.lotId), lotNameOf(lots, lease.lotId), lease.tenantName, lease.depositReceivedOn, lease.deposit, 0, 0, lease.deposit, situation],
        );
      });
    const returned = data.depositReturns.map((item) =>
      makeRow(
        item.number,
        { lotId: item.lotId },
        { building: buildingOf(lots, item.lotId), situation: 'Restitué' },
        [buildingOf(lots, item.lotId), lotNameOf(lots, item.lotId), item.tenantName, item.receivedOn, item.deposit, item.retained, item.returned, 0, 'Restitué'],
      ),
    );
    return [...held, ...returned];
  },
  kpis: (rows) => [
    { label: 'Dépôts détenus', value: formatRoundedEuros(sumAt(rows, depots('held'))) },
    { label: 'Total reçu', value: formatRoundedEuros(sumAt(rows, depots('deposit'))) },
    { label: 'Restitué', value: formatRoundedEuros(sumAt(rows, depots('returned'))) },
    { label: 'Retenues', value: formatRoundedEuros(sumAt(rows, depots('retained'))) },
  ],
};
