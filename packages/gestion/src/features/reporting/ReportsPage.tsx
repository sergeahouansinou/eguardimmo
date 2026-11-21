'use client';

import { Alert, Badge, Button, Card, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useMandants, usePartyNames, useReports } from './hooks';
import { dayTime, moneyText, periodText, plural, statusBadge } from './labels';
import { REPORT_STATUSES } from './model';
import type { Report, ReportStatus } from './model';
import { reportingPaths } from './paths';
import { AgencyGate, ReportingSections } from './parts';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { LinkButton, ListLoading, LoadError, PageHeader, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';

const ALL = 'all';

const statusOptions = [{ value: ALL, label: 'Tous les états' }, ...REPORT_STATUSES.map((status) => ({ value: status, label: statusBadge[status].label }))];

export function ReportsPage() {
  return (
    <AgencyGate>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Comptes rendus' }]}
        title="Comptes rendus"
        subtitle="Un compte rendu par mandant et par période, calculé par le serveur sur le grand livre, figé à la publication."
        actions={<LinkButton href={reportingPaths.generate} variant="primary" icon={ScrollText}>Générer les comptes rendus</LinkButton>}
      />
      <ReportingSections current="reports" />
      <ReportsCard />
    </AgencyGate>
  );
}

function ReportsCard() {
  const pages = useCursorPages();
  const [status, setStatus] = useState<ReportStatus | typeof ALL>(ALL);
  const [mandantId, setMandantId] = useState(ALL);
  const mandants = useMandants();
  const reports = useReports({ cursor: pages.cursor, status: status === ALL ? undefined : status, mandantId: mandantId === ALL ? undefined : mandantId });
  const rows = reports.data?.items ?? [];
  const names = usePartyNames(rows.map((row) => row.mandantId));

  return (
    <Card role="region" aria-label="Liste des comptes rendus" className="gap-3">
      <DueNotice due={reports.data?.due ?? null} />
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="État"
          placeholder="Tous les états"
          options={statusOptions}
          value={status}
          onValueChange={(value) => {
            setStatus(value === ALL ? ALL : (REPORT_STATUSES.find((candidate) => candidate === value) ?? ALL));
            pages.reset();
          }}
        />
        <Select
          label="Mandant"
          placeholder="Tous les mandants"
          searchable
          options={[{ value: ALL, label: 'Tous les mandants' }, ...(mandants.data ?? []).map((mandant) => ({ value: mandant.partyId, label: mandant.name }))]}
          value={mandantId}
          onValueChange={(value) => {
            setMandantId(value);
            pages.reset();
          }}
        />
      </div>
      {reports.isError ? <LoadError title={reports.error?.message ?? 'Les comptes rendus n’ont pas pu être chargés'} /> : null}
      {reports.isPending && !reports.isError ? <ListLoading label="Chargement des comptes rendus" /> : null}
      {reports.data && rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Aucun compte rendu" description="Générez les comptes rendus d’une période pour vos mandants : ils apparaîtront ici." />
      ) : null}
      {rows.length > 0 ? (
        <Table aria-label="Comptes rendus de gestion">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mandant</TableHeaderCell>
              <TableHeaderCell>Période</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell numeric>Loyers encaissés</TableHeaderCell>
              <TableHeaderCell numeric>Honoraires</TableHeaderCell>
              <TableHeaderCell numeric>Reversé</TableHeaderCell>
              <TableHeaderCell>Publication</TableHeaderCell>
              <TableHeaderCell><span className="sr-only">Action</span></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((report) => (
              <ReportRow key={report.id} report={report} name={names(report.mandantId, report.mandantName)} />
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={reports.data?.nextCursor ?? null} label="Pagination des comptes rendus" />
    </Card>
  );
}

function DueNotice({ due }: { due: { period: { start: string; end: string }; mandants: { partyId: string; name: string }[] } | null }) {
  const { Link } = useGestionNavigation();
  if (due === null || due.mandants.length === 0) return null;
  const query = new URLSearchParams({ du: due.period.start, au: due.period.end, mandants: due.mandants.map((mandant) => mandant.partyId).join(',') });
  return (
    <Alert
      tone="warning"
      title={`${plural(due.mandants.length, 'compte rendu à générer', 'comptes rendus à générer')} pour ${periodText(due.period)}`}
    >
      {due.mandants.map((mandant) => mandant.name).join(', ')}.{' '}
      <Button variant="link" asChild><Link href={`${reportingPaths.generate}?${query.toString()}`}>Générer maintenant</Link></Button>
    </Alert>
  );
}

function publicationText(report: Report): string {
  if (report.status === 'published' || report.status === 'superseded') return report.publishedAt === null ? '—' : `Publié le ${dayTime(report.publishedAt)}`;
  if (report.scheduledFor !== null) return `Planifié le ${dayTime(report.scheduledFor)}`;
  return '—';
}

function ReportRow({ report, name }: { report: Report; name: string }) {
  const { Link } = useGestionNavigation();
  const badge = statusBadge[report.status];
  const money = (value: Report['totals']['collected']) => (value === null ? '—' : moneyText(value));
  return (
    <TableRow>
      <TableCell strong>
        <Link href={reportingPaths.report(report.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{name}</Link>
        {report.number === null ? null : <span className="block text-caption font-normal text-fg-subtle">{report.number}</span>}
      </TableCell>
      <TableCell>{periodText(report.period)}</TableCell>
      <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
      <TableCell numeric>{money(report.totals.collected)}</TableCell>
      <TableCell numeric>{money(report.totals.fees)}</TableCell>
      <TableCell numeric>{money(report.totals.payout)}</TableCell>
      <TableCell>{publicationText(report)}</TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" asChild>
          <Link href={reportingPaths.report(report.id)}>
            {report.status === 'draft' ? 'Reprendre' : 'Ouvrir'}{' '}<span className="sr-only">{`le compte rendu de ${name}, ${periodText(report.period)}`}</span>
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
