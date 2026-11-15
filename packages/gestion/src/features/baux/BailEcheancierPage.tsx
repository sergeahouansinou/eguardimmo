'use client';

import { Badge, Button, Card, EmptyState, Select, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { CalendarX } from 'lucide-react';
import { useState } from 'react';
import { useLeaseLookups } from './BauxParts';
import { LeaseGate } from './LeaseGate';
import { useInstallments } from './hooks';
import { bauxPaths } from './paths';
import type { Installment, Lease } from './schemas';
import { courriersPaths, noticeIdOf, receiptIdOf } from '../courriers/paths';
import { LinkButton, ListLoading, LoadError, PageHeader, useGestionNavigation, useNotify } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const stateBadge: Record<Installment['state'], { label: string; tone: BadgeTone }> = {
  paye: { label: 'Payé', tone: 'success' },
  partiel: { label: 'Partiel', tone: 'warning' },
  impaye: { label: 'Impayé', tone: 'danger' },
  a_emettre: { label: 'À émettre', tone: 'info' },
};

const ALL = 'toutes';

export function BailEcheancierPage({ id }: { id: string }) {
  return <LeaseGate id={id} title="Échéancier">{(lease) => <Schedule lease={lease} />}</LeaseGate>;
}

function Schedule({ lease }: { lease: Lease }) {
  const installments = useInstallments(lease.id);
  const lookups = useLeaseLookups();
  const notify = useNotify();
  const [year, setYear] = useState(ALL);

  const rows = [...(installments.data ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  const years = [...new Set(rows.map((row) => row.month.slice(0, 4)))];
  const shown = rows.filter((row) => year === ALL || row.month.startsWith(year));
  const called = shown.filter((row) => row.state !== 'a_emettre').reduce((sum, row) => sum + row.called, 0);
  const received = shown.reduce((sum, row) => sum + row.received, 0);
  const unpaid = shown.filter((row) => row.state === 'impaye' || row.state === 'partiel').reduce((sum, row) => sum + (row.called - row.received), 0);

  const exportCsv = () => {
    downloadCsv(
      `echeancier-${lease.reference}.csv`,
      toCsv(
        ['Mois', 'Échéance', 'Appelé', 'Reçu', 'Payé le', 'Statut'],
        shown.map((row) => [monthLabel(row.month), formatDateFr(row.due), money(row.called), money(row.received), formatDateFr(row.paidOn), stateBadge[row.state].label]),
      ),
    );
    notify({ title: 'Export prêt', description: `${String(shown.length)} échéances exportées.` });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: lease.reference, href: bauxPaths.detail(lease.id) }, { label: 'Échéancier' }]}
        title="Échéancier"
        subtitle={`Bail ${lease.reference}, ${lookups.unitLabel(lease.unitId)}`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>Exporter</Button>
            <LinkButton href={links.newPayment({ locataire: lease.tenantIds[0] })} variant="primary">Enregistrer un paiement</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total appelé" value={money(called)} />
        <StatCard label="Total reçu" value={money(received)} />
        <StatCard label="Reste à percevoir" value={money(unpaid)} tone={unpaid > 0 ? 'danger' : 'default'} />
      </div>
      <Card role="region" aria-label="Échéances" className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select
            label="Année"
            hideLabel
            placeholder="Année"
            value={year}
            onValueChange={setYear}
            options={[{ value: ALL, label: 'Toutes les années' }, ...years.map((entry) => ({ value: entry, label: entry }))]}
            className="w-48"
          />
          <span className="text-caption text-fg-subtle">{`${String(shown.length)} échéances`}</span>
        </div>
        {installments.isError ? <LoadError title="L’échéancier n’a pas pu être chargé" /> : null}
        {installments.isPending ? <ListLoading label="Chargement de l’échéancier" /> : null}
        {installments.data && shown.length === 0 ? (
          <EmptyState icon={CalendarX} title="Aucune échéance" description={lease.status === 'brouillon' || lease.status === 'a_venir' ? 'Les échéances apparaissent à partir du début du bail.' : 'Aucune échéance pour cette période.'} />
        ) : null}
        {shown.length > 0 ? (
          <Table aria-label="Échéances du bail">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mois</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Appelé</TableHeaderCell>
                <TableHeaderCell numeric>Reçu</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((row) => (
                <InstallmentRow key={row.id} row={row} lease={lease} />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Card>
    </>
  );
}

function InstallmentRow({ row, lease }: { row: Installment; lease: Lease }) {
  const { Link } = useGestionNavigation();
  const badge = stateBadge[row.state];
  return (
    <TableRow>
      <TableCell strong>{monthLabel(row.month)}</TableCell>
      <TableCell>{formatDateFr(row.due)}</TableCell>
      <TableCell numeric>{money(row.called)}</TableCell>
      <TableCell numeric>{money(row.received)}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {row.lateSettled ? <Badge tone="neutral">Réglé en retard</Badge> : null}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-end gap-1.5">
          {row.receiptNumber ? (
            <Link href={courriersPaths.quittance(receiptIdOf(row.receiptNumber))} className="text-caption font-medium text-action-on-subtle underline-offset-2 hover:underline">Quittance</Link>
          ) : null}
          {row.state === 'a_emettre' ? (
            <Link href={courriersPaths.notice(noticeIdOf(lease.id, row.month))} className="text-caption font-medium text-action-on-subtle underline-offset-2 hover:underline">Avis d’échéance</Link>
          ) : null}
          {row.state === 'impaye' || row.state === 'partiel' ? (
            <LinkButton href={links.newCourrier({ modele: 'relance-de-loyer-impaye', locataire: lease.tenantIds[0], bien: lease.unitId })} size="sm" variant="primary">Relancer</LinkButton>
          ) : null}
        </span>
      </TableCell>
    </TableRow>
  );
}
