import { formatDecimal, formatRoundedEuros, plural } from '../../analytique/format';
import { indexOfColumns, sumAt } from '../engine/engine';
import { PAST_PERIODS } from '../engine/periods';
import type { ReportCell, ReportDefinition, ReportRow } from '../engine/types';
import { GROUP_BUILDING, GROUP_NONE, daysBetween, isCurrent, leasePayments, lotIndex, makeRow, buildingOf, lotNameOf } from './shared';

const APPELES_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'months', label: 'Avis', kind: 'int', total: 'sum' },
  { id: 'rent', label: 'Loyer', kind: 'money', total: 'sum' },
  { id: 'charges', label: 'Charges', kind: 'money', total: 'sum' },
  { id: 'called', label: 'Total appelé', kind: 'money', total: 'sum' },
] as const;
const appeles = indexOfColumns(APPELES_COLUMNS);

export const loyersAppeles: ReportDefinition = {
  slug: 'loyers-appeles',
  title: 'LOYERS APPELÉS',
  description: 'Avis d’échéance émis sur la période, loyer et provisions de charges.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: APPELES_COLUMNS,
  emptyHint: 'Aucun avis d’échéance n’a été émis sur cette période pour ce périmètre.',
  rows: ({ data, period }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const months = leasePayments(data, lease, period).length;
      if (months === 0) return [];
      return [
        makeRow(lease.lotId, { lotId: lease.lotId, tenantId: lease.tenantId }, { building: buildingOf(lots, lease.lotId) }, [
          buildingOf(lots, lease.lotId),
          lotNameOf(lots, lease.lotId),
          lease.tenantName,
          months,
          lease.rent * months,
          lease.charges * months,
          (lease.rent + lease.charges) * months,
        ]),
      ];
    });
  },
  kpis: (rows) => [
    { label: 'Total appelé', value: formatRoundedEuros(sumAt(rows, appeles('called'))), caption: plural(sumAt(rows, appeles('months')), 'avis émis', 'avis émis') },
    { label: 'Loyers hors charges', value: formatRoundedEuros(sumAt(rows, appeles('rent'))) },
    { label: 'Provisions de charges', value: formatRoundedEuros(sumAt(rows, appeles('charges'))) },
    { label: 'Lots concernés', value: String(rows.length) },
  ],
};

const AGE_INDEX = 8;
const maxAge = (rows: readonly ReportRow[]): ReportCell =>
  rows.reduce((max, row) => Math.max(max, typeof row.cells[AGE_INDEX] === 'number' ? row.cells[AGE_INDEX] : 0), 0);

const IMPAYES_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'months', label: 'Mois impayés', kind: 'int', total: 'sum' },
  { id: 'called', label: 'Appelé', kind: 'money', total: 'sum' },
  { id: 'collected', label: 'Encaissé', kind: 'money', total: 'sum' },
  { id: 'due', label: 'Reste dû', kind: 'money', total: 'sum' },
  { id: 'since', label: 'Depuis le', kind: 'date' },
  { id: 'age', label: 'Ancienneté (jours)', kind: 'int', total: maxAge },
] as const;
const impayes = indexOfColumns(IMPAYES_COLUMNS);

export const loyersImpayes: ReportDefinition = {
  slug: 'loyers-impayes',
  title: 'LOYERS IMPAYÉS',
  description: 'Restes dus par locataire et ancienneté de la première échéance impayée.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: IMPAYES_COLUMNS,
  emptyHint: 'Aucun impayé sur cette période : tous les loyers appelés ont été encaissés.',
  rows: ({ data, period, today }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const unpaid = leasePayments(data, lease, period).filter((payment) => payment.collected < payment.called);
      const first = unpaid[0];
      if (!first) return [];
      const called = unpaid.reduce((sum, payment) => sum + payment.called, 0);
      const collected = unpaid.reduce((sum, payment) => sum + payment.collected, 0);
      const since = `${first.month}-01`;
      const age = daysBetween(since, today);
      return [
        makeRow(
          lease.lotId,
          { lotId: lease.lotId, tenantId: lease.tenantId },
          { building: buildingOf(lots, lease.lotId) },
          [buildingOf(lots, lease.lotId), lotNameOf(lots, lease.lotId), lease.tenantName, unpaid.length, called, collected, called - collected, since, age],
          age > 30 ? 'danger' : 'warning',
        ),
      ];
    });
  },
  kpis: (rows) => [
    { label: 'Total impayé', value: formatRoundedEuros(sumAt(rows, impayes('due'))), tone: 'danger' },
    { label: 'Locataires concernés', value: String(rows.length) },
    { label: 'Ancienneté maximale', value: `${formatDecimal(Math.max(...rows.map((row) => (typeof row.cells[impayes('age')] === 'number' ? Number(row.cells[impayes('age')]) : 0))), 0)} j` },
    { label: 'Appelé sur la période', value: formatRoundedEuros(sumAt(rows, impayes('called'))) },
  ],
};

const SOLDES_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'tenant', label: 'Locataire', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'called', label: 'Appelé', kind: 'money', total: 'sum' },
  { id: 'collected', label: 'Encaissé', kind: 'money', total: 'sum' },
  { id: 'balance', label: 'Solde', kind: 'money', total: 'sum' },
  { id: 'situation', label: 'Situation', kind: 'text' },
] as const;
const soldes = indexOfColumns(SOLDES_COLUMNS);

export const soldesLocataires: ReportDefinition = {
  slug: 'soldes-des-locataires',
  title: 'SOLDES DES LOCATAIRES',
  description: 'Situation du compte de chaque locataire : encaissé moins appelé.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_NONE, GROUP_BUILDING],
  columns: SOLDES_COLUMNS,
  note: 'Un solde négatif correspond à une somme due par le locataire, un solde positif à un trop-perçu.',
  emptyHint: 'Aucun compte locataire n’a de mouvement sur cette période.',
  rows: ({ data, period }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const lines = leasePayments(data, lease, period);
      if (lines.length === 0) return [];
      const called = lines.reduce((sum, payment) => sum + payment.called, 0);
      const collected = lines.reduce((sum, payment) => sum + payment.collected, 0);
      const balance = collected - called;
      const situation = balance < 0 ? 'Débiteur' : balance > 0 ? 'Trop-perçu' : 'À jour';
      return [
        makeRow(
          lease.lotId,
          { lotId: lease.lotId, tenantId: lease.tenantId },
          { building: buildingOf(lots, lease.lotId) },
          [buildingOf(lots, lease.lotId), lease.tenantName, lotNameOf(lots, lease.lotId), called, collected, balance, situation],
          balance < 0 ? 'danger' : undefined,
        ),
      ];
    });
  },
  kpis: (rows) => {
    const balances = rows.map((row) => (typeof row.cells[soldes('balance')] === 'number' ? Number(row.cells[soldes('balance')]) : 0));
    return [
      { label: 'Dû par les locataires', value: formatRoundedEuros(-balances.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)), tone: 'danger' },
      { label: 'Trop-perçu', value: formatRoundedEuros(balances.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)) },
      { label: 'Comptes à jour', value: `${String(balances.filter((value) => value >= 0).length)} sur ${String(rows.length)}` },
      { label: 'Encaissé sur la période', value: formatRoundedEuros(sumAt(rows, soldes('collected'))) },
    ];
  },
};
