'use client';

import { Badge, Card, Checkbox, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FilePlus2, FileX } from 'lucide-react';
import { useState } from 'react';
import { InvoicingGate } from './InvoicingGate';
import { useInvoiceActions } from './InvoiceActions';
import { useInvoices, useInvoicingPermissions } from './hooks';
import { documentName, kindLabel, kindPlural, moneyText, statusBadge } from './labels';
import { INVOICE_KINDS, INVOICE_STATUSES } from './model';
import type { Invoice, InvoiceKind, InvoiceStatus } from './model';
import { invoicingPaths } from './paths';
import { useDebounced } from './useDebounced';
import { useRecipientDirectory } from './useRecipientDirectory';
import type { RecipientDirectory } from './useRecipientDirectory';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput, useGestionNavigation } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'toutes';
const YEARS_BACK = 5;

const kindOptions = [{ value: ALL, label: 'Factures et avoirs' }, ...INVOICE_KINDS.map((kind) => ({ value: kind, label: kindPlural[kind] }))];
const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...INVOICE_STATUSES.map((status) => ({ value: status, label: statusBadge[status].label }))];
const isKind = (value: string): value is InvoiceKind => INVOICE_KINDS.some((kind) => kind === value);
const isStatus = (value: string): value is InvoiceStatus => INVOICE_STATUSES.some((status) => status === value);

function yearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return [{ value: ALL, label: 'Toutes les années' }, ...Array.from({ length: YEARS_BACK + 1 }, (_, index) => String(current - index)).map((year) => ({ value: year, label: year }))];
}

export function InvoicesPage() {
  return (
    <InvoicingGate>
      <InvoicesList />
    </InvoicingGate>
  );
}

function InvoicesList() {
  const permissions = useInvoicingPermissions();
  const { search: params } = useGestionNavigation();
  const directory = useRecipientDirectory();
  const actions = useInvoiceActions();
  const pages = useCursorPages();
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [partyId, setPartyId] = useState(params.get('destinataire') ?? ALL);
  const [overdue, setOverdue] = useState(false);
  const [text, setText] = useState('');
  const searched = useDebounced(text.trim(), 300);

  const query = {
    cursor: pages.cursor,
    kind: isKind(kind) ? kind : undefined,
    status: isStatus(status) ? status : undefined,
    year: year === ALL ? undefined : Number(year),
    search: searched === '' ? undefined : searched,
    overdue: overdue ? true : undefined,
    partyId: partyId === ALL ? undefined : partyId,
  };
  const invoices = useInvoices(query);
  const rows = invoices.data?.items ?? [];
  const filtered = kind !== ALL || status !== ALL || year !== ALL || partyId !== ALL || overdue || searched !== '';
  const changed = <T,>(set: (value: T) => void) => (value: T) => { set(value); pages.reset(); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Factures' }]}
        title="Factures et avoirs"
        subtitle="Honoraires et prestations facturés aux mandants ; le reste dû est lu au grand livre."
        actions={permissions.write ? <LinkButton href={invoicingPaths.newInvoice(partyId === ALL ? undefined : partyId)} variant="primary" icon={FilePlus2}>Nouvelle facture</LinkButton> : null}
      />
      <Card role="region" aria-label="Factures" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Select label="Type" hideLabel placeholder="Type" value={kind} onValueChange={changed(setKind)} options={kindOptions} />
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={changed(setStatus)} options={statusOptions} />
          <Select label="Année" hideLabel placeholder="Année" value={year} onValueChange={changed(setYear)} options={yearOptions()} />
          <Select label="Destinataire" hideLabel placeholder="Destinataire" value={partyId} onValueChange={changed(setPartyId)} searchable searchPlaceholder="Rechercher un destinataire" options={[{ value: ALL, label: 'Tous les destinataires' }, ...directory.options]} />
          <SearchInput label="Rechercher un numéro" placeholder="Numéro, ex. FA-2026" value={text} onValueChange={changed(setText)} />
          <Checkbox label="En retard seulement" checked={overdue} onChange={(event) => { changed(setOverdue)(event.target.checked); }} />
        </div>
        {invoices.isError ? <LoadError title={invoices.error?.message ?? 'Les factures n’ont pas pu être chargées'} /> : null}
        {invoices.isPending && !invoices.isError ? <ListLoading label="Chargement des factures" /> : null}
        {invoices.data && rows.length === 0 ? (
          <EmptyState icon={FileX} title="Aucune facture" description={filtered ? 'Aucune facture ne correspond à ces filtres.' : 'Les factures et avoirs apparaissent ici dès qu’un brouillon est créé.'}>
            {permissions.write && !filtered ? <LinkButton href={invoicingPaths.newInvoice()} variant="primary" icon={FilePlus2}>Créer une facture</LinkButton> : null}
          </EmptyState>
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Factures et avoirs">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Numéro</TableHeaderCell>
                <TableHeaderCell>Destinataire</TableHeaderCell>
                <TableHeaderCell>Émise le</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Total TTC</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <InvoiceRow key={row.id} row={row} directory={directory} actions={actions.actionsFor(row)} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={invoices.data?.nextCursor ?? null} label="Pagination des factures" />
      </Card>
      {actions.dialogs}
    </>
  );
}

function InvoiceRow({ row, directory, actions }: { row: Invoice; directory: RecipientDirectory; actions: ActionItem[] }) {
  const { Link } = useGestionNavigation();
  const badge = statusBadge[row.status];
  const name = row.number === null ? `le brouillon du ${formatDateFr(row.createdAt)}` : documentName(row);
  return (
    <TableRow>
      <TableCell strong>
        <Link href={invoicingPaths.invoice(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{row.number ?? 'Brouillon'}</Link>
        {row.kind === 'credit_note' ? <span className="ml-1"><Badge tone="neutral">{kindLabel.credit_note}</Badge></span> : null}
      </TableCell>
      <TableCell>{directory.nameOf(row.recipientPartyId) ?? (directory.ready ? 'Destinataire inconnu' : '—')}</TableCell>
      <TableCell>{formatDateFr(row.issuedOn)}</TableCell>
      <TableCell>{formatDateFr(row.dueOn)}</TableCell>
      <TableCell numeric>{moneyText(row.totalGross)}</TableCell>
      <TableCell numeric className={row.outstanding && row.outstanding.amount > 0 ? 'text-fg-danger' : undefined}>{row.outstanding ? moneyText(row.outstanding) : '—'}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {row.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
        </span>
      </TableCell>
      <TableCell>{actions.length > 0 ? <ActionMenu label={`Actions pour ${name}`} items={actions} /> : null}</TableCell>
    </TableRow>
  );
}
