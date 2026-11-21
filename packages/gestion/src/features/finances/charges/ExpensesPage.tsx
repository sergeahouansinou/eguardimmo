'use client';

import { Badge, Button, Card, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ExportExpensesDialog } from './ExportDialog';
import { useExpenses, useChargesPermissions } from './hooks';
import { expenseStatusBadge, moneyText, settlementLabel } from './labels';
import { EXPENSE_SETTLEMENTS, EXPENSE_STATUSES } from './model';
import type { ExpenseQuery } from './model';
import { ChargesGate, ChargesSections } from './parts/ChargesGate';
import { usePropertyLabels, useTermLabels } from './parts/choices';
import { chargesPaths } from './paths';
import { LinkButton, ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = '';

export function ExpensesPage() {
  return (
    <ChargesGate>
      <ExpensesContent />
    </ChargesGate>
  );
}

function ExpensesContent() {
  const permissions = useChargesPermissions();
  const pages = useCursorPages();
  const [propertyId, setPropertyId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [settlement, setSettlement] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const properties = usePropertyLabels();

  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    pages.reset();
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Dépenses' }]}
        title="Dépenses"
        subtitle="Factures et relevés de l’immeuble : ce sont elles qui nourrissent la régularisation annuelle des charges."
        actions={
          <>
            {permissions.export ? (
              <Button variant="secondary" onClick={() => { setExporting(true); }}>
                <Icon icon={Download} />
                Exporter en CSV
              </Button>
            ) : null}
            {permissions.write ? <LinkButton href={chargesPaths.expenseNew} variant="primary" icon={Plus}>Nouvelle dépense</LinkButton> : null}
          </>
        }
      />
      <ChargesSections current="expenses" />
      <Card role="region" aria-label="Liste des dépenses" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Bien" placeholder="Tous les biens" options={[{ value: ALL, label: 'Tous les biens' }, ...properties.options]} value={propertyId} onValueChange={filter(setPropertyId)} searchable />
          <Select label="Statut" placeholder="Tous les statuts" options={[{ value: ALL, label: 'Tous les statuts' }, ...EXPENSE_STATUSES.map((value) => ({ value, label: expenseStatusBadge[value].label }))]} value={status} onValueChange={filter(setStatus)} />
          <Select label="Règlement" placeholder="Tous les règlements" options={[{ value: ALL, label: 'Tous les règlements' }, ...EXPENSE_SETTLEMENTS.map((value) => ({ value, label: settlementLabel[value] }))]} value={settlement} onValueChange={filter(setSettlement)} />
          <TextField label="Pièce à partir du" type="date" placeholder="AAAA-MM-JJ" value={from} onChange={(event) => { filter(setFrom)(event.target.value); }} />
          <TextField label="Pièce avant le" type="date" placeholder="AAAA-MM-JJ" value={to} onChange={(event) => { filter(setTo)(event.target.value); }} />
        </div>
        <ExpensesTable
          query={{
            cursor: pages.cursor,
            propertyId: propertyId === ALL ? null : propertyId,
            status: EXPENSE_STATUSES.find((value) => value === status) ?? null,
            settlement: EXPENSE_SETTLEMENTS.find((value) => value === settlement) ?? null,
            from: from === '' ? null : from,
            to: to === '' ? null : to,
          }}
          pages={pages}
          propertyName={properties.nameOf}
        />
      </Card>
      <ExportExpensesDialog open={exporting} onClose={() => { setExporting(false); }} />
    </>
  );
}

function ExpensesTable({ query, pages, propertyName }: { query: ExpenseQuery; pages: ReturnType<typeof useCursorPages>; propertyName: (id: string) => string }) {
  const { Link } = useGestionNavigation();
  const expenses = useExpenses(query);
  const categories = useTermLabels('expense_category');

  if (expenses.isPending) return <ListLoading label="Chargement des dépenses" />;
  if (expenses.isError || expenses.data === undefined) return <LoadError title="Impossible de charger les dépenses" />;
  if (expenses.data.items.length === 0) return <NoRows>{pages.page > 1 || Object.values({ ...query, cursor: null }).some((value) => value !== null) ? 'Aucune dépense ne correspond à ces filtres.' : 'Aucune dépense enregistrée. Saisissez la première facture de l’immeuble.'}</NoRows>;

  return (
    <>
      <Table aria-label="Dépenses">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Pièce</TableHeaderCell>
            <TableHeaderCell>Fournisseur</TableHeaderCell>
            <TableHeaderCell>Bien</TableHeaderCell>
            <TableHeaderCell>Catégorie</TableHeaderCell>
            <TableHeaderCell numeric>Montant TTC</TableHeaderCell>
            <TableHeaderCell numeric>Récupérable</TableHeaderCell>
            <TableHeaderCell>Règlement</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {expenses.data.items.map((expense) => {
            const badge = expenseStatusBadge[expense.status];
            return (
              <TableRow key={expense.id}>
                <TableCell>
                  <Link href={chargesPaths.expense(expense.id)} className="font-medium text-action-on-subtle underline-offset-2 hover:underline">{formatDateFr(expense.documentOn)}</Link>
                </TableCell>
                <TableCell>{expense.payeeLabel ?? expense.reference ?? '—'}</TableCell>
                <TableCell>{propertyName(expense.propertyId)}</TableCell>
                <TableCell>{categories.labelOf(expense.categoryTermId)}</TableCell>
                <TableCell numeric>{moneyText(expense.totalGross)}</TableCell>
                <TableCell numeric>{moneyText(expense.recoverableAmount)}</TableCell>
                <TableCell>{settlementLabel[expense.settlement]}</TableCell>
                <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={expenses.data.nextCursor} label="Pagination des dépenses" />
    </>
  );
}
