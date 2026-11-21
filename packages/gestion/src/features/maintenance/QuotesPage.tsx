'use client';

import { Alert, Badge, Button, Card, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FileText, X } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { LinkButton, ListLoading, PageHeader, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useQuotes, useSupplierChoices } from './hooks';
import { approvalBadge, quoteBadge, quoteKindLabel, statusBadge } from './labels';
import { MaintenanceGate } from './MaintenanceGate';
import { QUOTE_STATUSES } from './model';
import type { QuoteSummary } from './model';
import { maintenancePaths } from './paths';
import { ALL, buildQuoteQuery, interventionFilterFrom } from './quoteFilters';

const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...QUOTE_STATUSES.map((status) => ({ value: status, label: quoteBadge[status].label }))];
const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Interventions', href: maintenancePaths.interventions }, { label: 'Devis' }];
const linkClass = 'inline-flex min-h-6 items-center text-action-on-subtle underline-offset-2 hover:underline';

export function QuotesPage() {
  return (
    <MaintenanceGate>
      <QuotesList />
    </MaintenanceGate>
  );
}

function QuotesList() {
  const { search } = useGestionNavigation();
  const interventionId = interventionFilterFrom(search);
  const [status, setStatus] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const filters = buildQuoteQuery({ status, supplier, interventionId });
  const quotes = useQuotes(filters);
  const suppliers = useSupplierChoices();
  const supplierNames = new Map((suppliers.data ?? []).map((choice) => [choice.id, choice.name]));
  const supplierOptions = [{ value: ALL, label: 'Tous les prestataires' }, ...(suppliers.data ?? []).map((choice) => ({ value: choice.id, label: choice.name }))];
  const rows = quotes.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = status !== ALL || supplier !== ALL || interventionId !== undefined;
  const failedFirstPage = quotes.isError && !quotes.isFetchNextPageError;

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title="Devis"
        subtitle="Devis reçus des prestataires et leur accord du mandant, toutes interventions confondues."
        actions={<LinkButton href={maintenancePaths.interventions}>Voir les interventions</LinkButton>}
      />
      <Card role="region" aria-label="Devis" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={setStatus} options={statusOptions} />
          <Select
            label="Prestataire"
            hideLabel
            placeholder={suppliers.isError ? 'Prestataires indisponibles' : 'Prestataire'}
            value={supplier}
            onValueChange={setSupplier}
            options={supplierOptions}
            disabled={suppliers.isError}
            searchable
          />
          {interventionId === undefined ? null : <InterventionFilterChip />}
        </div>
        {failedFirstPage ? <FirstPageError message={quotes.error.message} onRetry={() => { void quotes.refetch(); }} /> : null}
        {quotes.isPending ? <ListLoading label="Chargement des devis" /> : null}
        {quotes.data && rows.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun devis" description={filtered ? 'Aucun devis ne correspond à ces filtres.' : 'Les devis reçus des prestataires apparaissent ici.'} />
        ) : null}
        {rows.length > 0 ? <QuotesTable rows={rows} supplierNames={supplierNames} /> : null}
        {quotes.isFetchNextPageError ? <NextPageError message={quotes.error.message} onRetry={() => { void quotes.fetchNextPage(); }} /> : null}
        {quotes.hasNextPage && !quotes.isFetchNextPageError ? (
          <div className="flex justify-center border-t border-line pt-2">
            <Button variant="secondary" loading={quotes.isFetchingNextPage} onClick={() => { void quotes.fetchNextPage(); }}>
              Charger plus de devis
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}

function InterventionFilterChip() {
  const { Link } = useGestionNavigation();
  return (
    <p className="flex min-w-0 items-center gap-2 text-body text-fg-muted">
      <Badge tone="info">Une seule intervention</Badge>
      <Link href={maintenancePaths.quotes} className={linkClass}>
        <X aria-hidden="true" className="mr-1 size-4" />
        Retirer ce filtre
      </Link>
    </p>
  );
}

function FirstPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert tone="danger" title="Les devis n’ont pas pu être chargés">
      <span className="[overflow-wrap:anywhere]">{message}</span>
      <span className="mt-2 flex">
        <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>
      </span>
    </Alert>
  );
}

function NextPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert tone="danger" title="La page suivante n’a pas pu être chargée">
      <span className="[overflow-wrap:anywhere]">{message}</span>
      <span className="mt-2 flex">
        <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>
      </span>
    </Alert>
  );
}

function QuotesTable({ rows, supplierNames }: { rows: readonly QuoteSummary[]; supplierNames: ReadonlyMap<string, string> }) {
  return (
    <Table aria-label="Devis" scrollLabel="Devis, défilement horizontal">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Devis</TableHeaderCell>
          <TableHeaderCell>Intervention</TableHeaderCell>
          <TableHeaderCell>Prestataire</TableHeaderCell>
          <TableHeaderCell>Émis le</TableHeaderCell>
          <TableHeaderCell numeric>Total TTC</TableHeaderCell>
          <TableHeaderCell>Statut</TableHeaderCell>
          <TableHeaderCell>Accord du mandant</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => <QuoteRow key={row.id} row={row} supplierName={row.supplierPartyId === null ? undefined : supplierNames.get(row.supplierPartyId)} />)}
      </TableBody>
    </Table>
  );
}

function QuoteRow({ row, supplierName }: { row: QuoteSummary; supplierName: string | undefined }) {
  const { Link } = useGestionNavigation();
  const badge = quoteBadge[row.status];
  return (
    <TableRow>
      <TableCell strong>
        <span className="flex flex-col">
          <span>{row.reference}</span>
          <span className="text-caption font-normal text-fg-subtle">{quoteKindLabel[row.kind]}</span>
        </span>
      </TableCell>
      <TableCell>
        <Link href={maintenancePaths.intervention(row.interventionId)} className={linkClass}>
          {row.intervention?.reference ?? 'Intervention'}
        </Link>
        {row.intervention ? <Badge tone={statusBadge[row.intervention.status].tone} className="ml-2">{statusBadge[row.intervention.status].label}</Badge> : null}
      </TableCell>
      <TableCell>{supplierName ?? '—'}</TableCell>
      <TableCell>{formatDateFr(row.issuedOn)}</TableCell>
      <TableCell numeric>{formatMoney(row.totalGross.amount, row.totalGross.currency)}</TableCell>
      <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
      <TableCell>
        {row.approval ? (
          <span className="flex flex-col gap-0.5">
            <Badge tone={approvalBadge[row.approval.status].tone}>{approvalBadge[row.approval.status].label}</Badge>
            <span className="text-caption text-fg-subtle">{`Plafond ${formatMoney(row.approval.ceilingAmount.amount, row.approval.ceilingAmount.currency)} · avant le ${formatDateFr(row.approval.decideBefore)}`}</span>
          </span>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}
