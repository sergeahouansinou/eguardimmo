'use client';

import { Alert, Button, Card, EmptyState, Pagination, Select, StatCard, Tab, TabList, TabPanel, Table, TableBody, TableHead, TableHeaderCell, TableRow, Tabs } from '@eguardimmo/ui';
import { Banknote, CalendarX } from 'lucide-react';
import { useState } from 'react';
import { AcomptesList, AvailableAcomptesCard, useLeaseAcomptes } from './AcomptesParts';
import { useLeaseLookups } from './BauxParts';
import { AllocationOrder, InstallmentRow, ScheduleDocuments, arrearsByInstallment, stateBadge } from './EcheancierParts';
import { LeaseGate } from './LeaseGate';
import { useInstallments } from './hooks';
import { bauxPaths } from './paths';
import type { Lease } from './schemas';
import { LinkButton, ListLoading, LoadError, PageHeader, useNotify } from '../locataires/kit';
import { downloadCsv, toCsv } from '../locataires/kit/csv';
import { formatDateFr, monthLabel } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { money } from '../locataires/kit/money';

const ALL = 'toutes';
const PAGE_SIZE = 12;

export function BailEcheancierPage({ id }: { id: string }) {
  return <LeaseGate id={id} title="Échéancier">{(lease) => <Schedule lease={lease} />}</LeaseGate>;
}

function Schedule({ lease }: { lease: Lease }) {
  const installments = useInstallments(lease.id);
  const acomptes = useLeaseAcomptes(lease.reference);
  const lookups = useLeaseLookups();
  const notify = useNotify();
  const [year, setYear] = useState(ALL);
  const [tab, setTab] = useState('toutes');
  const [page, setPage] = useState(1);

  const rows = [...(installments.data ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  const years = [...new Set(rows.map((row) => row.month.slice(0, 4)))];
  const inYear = rows.filter((row) => year === ALL || row.month.startsWith(year));
  const isUnpaid = (state: string) => state === 'impaye' || state === 'partiel';
  const tabs: { id: string; label: string; count: number; match: (state: string) => boolean }[] = [
    { id: 'toutes', label: 'Toutes', count: inYear.length, match: () => true },
    { id: 'impayees', label: 'Impayées', count: inYear.filter((row) => isUnpaid(row.state)).length, match: isUnpaid },
    { id: 'soldees', label: 'Soldées', count: inYear.filter((row) => row.state === 'paye').length, match: (state: string) => state === 'paye' },
  ];
  const activeMatch = tabs.find((entry) => entry.id === tab)?.match ?? (() => true);
  const shown = inYear.filter((row) => activeMatch(row.state));
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const arrears = arrearsByInstallment(rows);
  const priorDebt = rows.filter((row) => isUnpaid(row.state)).reduce((sum, row) => sum + (row.called - row.received), 0);
  const nextNotice = rows.find((row) => row.state === 'a_emettre');
  const called = inYear.filter((row) => row.state !== 'a_emettre').reduce((sum, row) => sum + row.called, 0);
  const received = inYear.reduce((sum, row) => sum + row.received, 0);
  const unpaid = inYear.filter((row) => isUnpaid(row.state)).reduce((sum, row) => sum + (row.called - row.received), 0);

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
            <LinkButton href={links.newPayment({ locataire: lease.tenantIds[0] })} variant="primary" icon={Banknote}>Enregistrer un paiement</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total appelé" value={money(called)} />
        <StatCard label="Total reçu" value={money(received)} />
        <StatCard label="Reste à percevoir" value={money(unpaid)} tone={unpaid > 0 ? 'danger' : 'default'} />
        <StatCard label="Dettes antérieures" value={money(priorDebt)} tone={priorDebt > 0 ? 'danger' : 'default'}>
          <span className="text-caption text-fg-subtle">
            {priorDebt === 0 ? 'Aucune dette antérieure' : nextNotice ? `Reportées sur l’avis de ${monthLabel(nextNotice.month).toLowerCase()}` : 'À régulariser'}
          </span>
        </StatCard>
        <AvailableAcomptesCard query={acomptes} />
        <StatCard label="Dépôt de garantie" value={money(lease.deposit)}>
          <span className="text-caption text-fg-subtle">{lease.depositReceivedOn ? 'Détenu, restitué à la sortie' : 'Non reçu'}</span>
        </StatCard>
      </div>
      <Alert tone="info" title="Règle des quittances">
        Une quittance n’est émise que lorsque l’échéance est soldée, dettes antérieures comprises.
      </Alert>
      <Card role="region" aria-label="Échéances" className="gap-3">
        <Tabs value={tab} onValueChange={(value) => { setTab(value); setPage(1); }} defaultValue="toutes">
          <TabList aria-label="Filtrer les échéances">
            {tabs.map((entry) => (
              <Tab key={entry.id} value={entry.id} count={entry.count}>{entry.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                label="Année"
                hideLabel
                placeholder="Année"
                value={year}
                onValueChange={(value) => { setYear(value); setPage(1); }}
                options={[{ value: ALL, label: 'Toutes les années' }, ...years.map((entry) => ({ value: entry, label: entry }))]}
                className="w-48"
              />
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
                    <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                    <TableHeaderCell numeric>Arriéré cumulé</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Quittance</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((row) => (
                    <InstallmentRow key={row.id} row={row} lease={lease} arrears={arrears.get(row.id) ?? 0} />
                  ))}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={current} pageSize={PAGE_SIZE} total={shown.length} onPageChange={setPage} label="Pagination des échéances" />
          </TabPanel>
        </Tabs>
      </Card>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <AllocationOrder />
        <ScheduleDocuments rows={rows} priorDebt={priorDebt} acomptes={acomptes.data} />
        <div className="lg:col-span-2">
          <AcomptesList query={acomptes} />
        </div>
      </div>
    </>
  );
}
