import { formatEuros, formatRoundedEuros } from '../../analytique/format';
import { indexOfColumns, sumAt } from '../engine/engine';
import { PAST_PERIODS, YEAR_PERIODS, inPeriod, monthInPeriod } from '../engine/periods';
import type { ReportDefinition, ReportRow } from '../engine/types';
import { GROUP_NONE, lotIndex, lotNameOf, makeRow } from './shared';

const FONCIERS_COLUMNS = [
  { id: 'category', label: 'Catégorie', kind: 'text' },
  { id: 'detail', label: 'Détail', kind: 'text' },
  { id: 'nature', label: 'Nature', kind: 'text' },
  { id: 'amount', label: 'Montant', kind: 'money' },
  { id: 'proofs', label: 'Justificatifs', kind: 'text' },
] as const;
const foncier = indexOfColumns(FONCIERS_COLUMNS);

const AMORTISSEMENTS = 'Amortissements (LMNP)';

export const revenusFonciers: ReportDefinition = {
  slug: 'revenus-fonciers',
  title: 'REVENUS FONCIERS',
  description: 'Recettes, charges déductibles et résultat, pour préparer la déclaration annuelle.',
  periods: YEAR_PERIODS,
  filters: { lot: false, tenant: false },
  groups: [{ value: 'nature', label: 'Regrouper par : Nature', attr: 'nature' }, GROUP_NONE],
  columns: FONCIERS_COLUMNS,
  note: 'Document d’aide à la déclaration, à faire valider par votre comptable avant tout dépôt.',
  emptyHint: 'Aucune donnée fiscale n’est disponible pour cette année.',
  rows: ({ data, period }) => {
    const balance = data.yearBalances.find((item) => String(item.year) === period.from.slice(0, 4));
    if (!balance) return [];
    const lines = balance.lines.map((line) =>
      makeRow(
        line.id,
        {},
        { nature: line.kind === 'recette' ? 'Recettes' : 'Charges' },
        [line.label, line.detail, line.kind === 'recette' ? 'Recette' : 'Charge', line.amount, line.missingProofs > 0 ? `${String(line.missingProofs)} manquants` : 'Complets'],
        line.missingProofs > 0 ? 'warning' : undefined,
      ),
    );
    return [...lines, makeRow('amortissements', {}, { nature: 'Charges' }, [AMORTISSEMENTS, 'Amortissements du mobilier et du bâti', 'Charge', balance.depreciation, 'Complets'])];
  },
  kpis: (rows) => {
    const by = (nature: string): number => rows.filter((row) => row.cells[foncier('nature')] === nature).reduce((sum, row) => sum + Number(row.cells[foncier('amount')]), 0);
    const income = by('Recette');
    const charges = by('Charge');
    return [
      { label: 'Recettes', value: formatRoundedEuros(income) },
      { label: 'Charges déductibles', value: formatRoundedEuros(charges) },
      { label: 'Résultat foncier', value: formatRoundedEuros(income - charges), tone: income - charges < 0 ? 'danger' : 'default' },
      { label: 'Justificatifs manquants', value: String(rows.filter((row) => row.tone === 'warning').length) },
    ];
  },
};

const ACCOUNTS: Record<string, string> = {
  Réparation: '615000',
  Entretien: '615000',
  Taxe: '635000',
  Assurance: '616000',
  Énergie: '606000',
  Autre: '618000',
};

const COMPTA_COLUMNS = [
  { id: 'date', label: 'Date', kind: 'date' },
  { id: 'journal', label: 'Journal', kind: 'text' },
  { id: 'piece', label: 'Pièce', kind: 'text' },
  { id: 'label', label: 'Libellé', kind: 'text' },
  { id: 'debit', label: 'Compte débité', kind: 'text' },
  { id: 'credit', label: 'Compte crédité', kind: 'text' },
  { id: 'amount', label: 'Montant', kind: 'cents', total: 'sum' },
] as const;
const compta = indexOfColumns(COMPTA_COLUMNS);

const JOURNALS: Record<string, string> = { VT: 'Ventes (loyers appelés)', BQ: 'Banque (encaissements)', AC: 'Achats (dépenses)' };

export const exportComptable: ReportDefinition = {
  slug: 'export-comptable',
  title: 'EXPORT COMPTABLE',
  description: 'Écritures de la période : loyers appelés, encaissements et dépenses.',
  periods: PAST_PERIODS,
  filters: { lot: true, tenant: true },
  groups: [GROUP_NONE, { value: 'journal', label: 'Regrouper par : Journal', attr: 'journal' }],
  columns: COMPTA_COLUMNS,
  note: 'Écritures datées de l’échéance du loyer. Montants en euros, séparateur décimal virgule.',
  emptyHint: 'Aucune écriture comptable sur cette période pour ce périmètre.',
  rows: ({ data, period }) => {
    const lots = lotIndex(data);
    const tenantOf = (lotId: string) => data.leases.find((lease) => lease.lotId === lotId && lease.status !== 'a_venir');
    const entries: ReportRow[] = [];
    for (const payment of data.payments) {
      if (!monthInPeriod(payment.month, period)) continue;
      const lease = tenantOf(payment.lotId);
      const ids = { lotId: payment.lotId, tenantId: lease?.tenantId ?? null };
      const lot = lotNameOf(lots, payment.lotId);
      const who = lease?.tenantName ?? lot;
      entries.push(makeRow(`vt-${payment.lotId}-${payment.month}`, ids, { journal: JOURNALS.VT ?? 'VT' }, [`${payment.month}-01`, 'VT', `AV-${payment.month}-${payment.lotId}`, `Loyer et charges ${payment.month}, ${who}, ${lot}`, '411000', '706000', payment.called]));
      if (payment.collected > 0) {
        entries.push(makeRow(`bq-${payment.lotId}-${payment.month}`, ids, { journal: JOURNALS.BQ ?? 'BQ' }, [`${payment.month}-01`, 'BQ', `RG-${payment.month}-${payment.lotId}`, `Règlement ${payment.month}, ${who}, ${lot}`, '512000', '411000', payment.collected]));
      }
    }
    for (const expense of data.expenses) {
      if (!inPeriod(expense.date, period)) continue;
      const lot = data.lots.find((item) => item.name === expense.lotName && item.buildingName === expense.buildingName);
      entries.push(makeRow(`ac-${expense.id}`, { lotId: lot?.id ?? null }, { journal: JOURNALS.AC ?? 'AC' }, [expense.date, 'AC', expense.id.toUpperCase(), `${expense.description} ${expense.supplier}, ${expense.lotName}`.trim(), ACCOUNTS[expense.kind] ?? '618000', '401000', expense.amount]));
    }
    return entries.sort((a, b) => String(a.cells[compta('date')]).localeCompare(String(b.cells[compta('date')])) || a.id.localeCompare(b.id));
  },
  kpis: (rows) => {
    const by = (journal: string): number => rows.filter((row) => row.cells[compta('journal')] === journal).reduce((sum, row) => sum + Number(row.cells[compta('amount')]), 0);
    return [
      { label: 'Écritures', value: String(rows.length) },
      { label: 'Loyers appelés', value: formatEuros(by('VT')) },
      { label: 'Encaissements', value: formatEuros(by('BQ')) },
      { label: 'Dépenses', value: formatEuros(by('AC')) },
    ];
  },
};

const TVA_COLUMNS = [
  { id: 'month', label: 'Mois', kind: 'text' },
  { id: 'documents', label: 'Documents', kind: 'int', total: 'sum' },
  { id: 'base', label: 'Base hors taxe', kind: 'cents', total: 'sum' },
  { id: 'collected', label: 'TVA collectée', kind: 'cents', total: 'sum' },
  { id: 'deductible', label: 'TVA payée sur dépenses', kind: 'cents', total: 'sum' },
  { id: 'due', label: 'TVA à reverser', kind: 'cents', total: 'sum' },
] as const;
const tva = indexOfColumns(TVA_COLUMNS);

export const tvaCollecteePayee: ReportDefinition = {
  slug: 'tva-collectee-et-payee',
  title: 'TVA COLLECTÉE ET PAYÉE',
  description: 'Factures émises et TVA correspondante, mois par mois.',
  periods: PAST_PERIODS,
  filters: { lot: false, tenant: false },
  groups: [GROUP_NONE],
  columns: TVA_COLUMNS,
  note: 'Les locations nues ne sont pas soumises à la TVA : les factures émises portent un taux de 0 %. Aucune TVA n’est enregistrée sur les dépenses.',
  emptyHint: 'Aucune facture n’a été émise sur cette période.',
  rows: ({ data, period }) => {
    const months = [...new Set(data.invoices.filter((invoice) => inPeriod(invoice.date, period)).map((invoice) => invoice.date.slice(0, 7)))].sort();
    return months.map((month) => {
      const invoices = data.invoices.filter((invoice) => invoice.date.startsWith(month));
      const base = invoices.reduce((sum, invoice) => sum + invoice.amountHt, 0);
      const collected = invoices.reduce((sum, invoice) => sum + (invoice.amountTtc - invoice.amountHt), 0);
      return makeRow(month, {}, {}, [month, invoices.length, base, collected, 0, collected]);
    });
  },
  kpis: (rows) => [
    { label: 'Base hors taxe', value: formatEuros(sumAt(rows, tva('base'))) },
    { label: 'TVA collectée', value: formatEuros(sumAt(rows, tva('collected'))) },
    { label: 'TVA payée sur dépenses', value: formatEuros(sumAt(rows, tva('deductible'))) },
    { label: 'Documents émis', value: String(sumAt(rows, tva('documents'))) },
  ],
};
