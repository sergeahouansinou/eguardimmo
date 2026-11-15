'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Download, Eye } from 'lucide-react';
import { Button, Icon, Select } from '@eguardimmo/ui';
import { DataTable, EmptyBlock, PageHeader, QueryState, Td, Th } from '../kit';
import type { ScreenProps } from '../kit';
import { KpiCard } from '../analytique/components/KpiCard';
import { downloadCsv } from '../analytique/csv';
import { formatPercentValue, formatRoundedEuros, plural } from '../analytique/format';
import { MODELED_SLUG, reportHref } from './catalog';
import { GROUP_OPTIONS, LOYERS_DEFAULTS, PERIODS, PERIOD_OPTIONS, buildLoyers, decodeFilters, encodeFilters, loyersDataset, parseGroup, parsePeriod } from './loyers';
import type { LoyerGroup, LoyersFilters, LoyersView } from './loyers';
import { ScheduleDialog } from './SendDialogs';
import { useLoyersData } from './source';
import type { LoyersData } from './schemas';

const REPORT = { slug: MODELED_SLUG, label: 'Loyers encaissés' };

const ALL = 'all';

export interface RapportLoyersPageProps extends ScreenProps {
  search?: string;
}

export function RapportLoyersPage({ Link, navigate, search = '' }: RapportLoyersPageProps) {
  const query = useLoyersData();
  const [filters, setFilters] = useState<LoyersFilters>(() => decodeFilters(new URLSearchParams(search)));
  const [scheduling, setScheduling] = useState(false);
  const view = useMemo(() => (query.data ? buildLoyers(query.data, filters) : null), [query.data, filters]);
  const patch = (next: Partial<LoyersFilters>) => { setFilters((current) => ({ ...current, ...next })); };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports', href: '/rapports' }, { label: REPORT.label }]}
        title={REPORT.label}
        description="Paiements reçus sur la période, comparés aux loyers appelés."
        actions={
          <>
            <Button variant="ghost" onClick={() => { setScheduling(true); }}>
              <Icon icon={CalendarClock} />
              Programmer l’envoi
            </Button>
            <Button variant="secondary" disabled={!view?.hasData} onClick={() => { if (view) downloadCsv('loyers-encaisses', loyersDataset(view)); }}>
              <Icon icon={Download} />
              Exporter en Excel
            </Button>
            <Button onClick={() => { navigate(`${reportHref(REPORT.slug)}/apercu?${encodeFilters(filters)}`); }}>
              <Icon icon={Eye} />
              Aperçu PDF
            </Button>
          </>
        }
      />
      <QueryState query={query} errorTitle="Le rapport n’a pas pu être chargé">
        {(data) => (
          <>
            <Filters data={data} filters={filters} onChange={patch} onReset={() => { setFilters(LOYERS_DEFAULTS); }} />
            {view?.hasData ? (
              <>
                <Kpis view={view} />
                <LoyersTable view={view} generatedOn={data.today} />
              </>
            ) : (
              <EmptyBlock
                title="Aucun loyer sur cette période"
                action={
                  <Button variant="secondary" size="sm" onClick={() => { setFilters(LOYERS_DEFAULTS); }}>
                    Réinitialiser les filtres
                  </Button>
                }
              >
                Aucun avis d’échéance ne correspond à la période, au bien et au locataire choisis.
              </EmptyBlock>
            )}
            <ScheduleDialog open={scheduling} onOpenChange={setScheduling} report={REPORT} />
          </>
        )}
      </QueryState>
    </>
  );
}

function Filters({ data, filters, onChange, onReset }: { data: LoyersData; filters: LoyersFilters; onChange: (next: Partial<LoyersFilters>) => void; onReset: () => void }) {
  const tenants = [...new Map(data.lots.map((lot) => [lot.tenantId, lot.tenantName])).entries()];
  return (
    <section aria-label="Filtres" className="flex flex-wrap items-center gap-2">
      <Select
        label="Période"
        hideLabel
        placeholder="Période"
        options={PERIOD_OPTIONS.map((option) => ({ value: option.value, label: `${option.label} : ${PERIODS[option.value].start} → ${PERIODS[option.value].end}` }))}
        value={filters.period}
        onValueChange={(value) => { onChange({ period: parsePeriod(value) }); }}
        className="w-full sm:w-[320px]"
      />
      <Select
        label="Bien"
        hideLabel
        placeholder="Bien : Tous"
        options={[{ value: ALL, label: 'Bien : Tous' }, ...data.lots.map((lot) => ({ value: lot.id, label: `Bien : ${lot.name}` }))]}
        value={filters.lotId}
        onValueChange={(lotId) => { onChange({ lotId }); }}
        className="w-full sm:w-[170px]"
      />
      <Select
        label="Locataire"
        hideLabel
        placeholder="Locataire : Tous"
        options={[{ value: ALL, label: 'Locataire : Tous' }, ...tenants.map(([id, name]) => ({ value: id, label: `Locataire : ${name}` }))]}
        value={filters.tenantId}
        onValueChange={(tenantId) => { onChange({ tenantId }); }}
        className="w-full sm:w-[230px]"
      />
      <Select
        label="Regroupement"
        hideLabel
        placeholder="Regrouper par : Immeuble"
        options={GROUP_OPTIONS}
        value={filters.group}
        onValueChange={(value) => { onChange({ group: parseGroup(value) }); }}
        className="w-full sm:w-[230px]"
      />
      <Button variant="ghost" size="sm" onClick={onReset}>
        Réinitialiser
      </Button>
    </section>
  );
}

function Kpis({ view }: { view: LoyersView }) {
  const { totals } = view;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Loyers appelés" value={formatRoundedEuros(totals.called)} caption={plural(totals.notices, 'avis émis', 'avis émis')} />
      <KpiCard label="Loyers encaissés" value={formatRoundedEuros(totals.collected)} caption={plural(totals.payments, 'paiement reçu', 'paiements reçus')} />
      <KpiCard label="Taux d’encaissement" value={formatPercentValue(totals.rate)} />
      <KpiCard
        label="Reste dû"
        value={formatRoundedEuros(totals.dueGross)}
        tone={totals.dueGross > 0 ? 'danger' : 'default'}
        caption={totals.overpaid > 0 ? `dont ${formatRoundedEuros(totals.overpaid)} de trop perçu à déduire` : undefined}
      />
    </div>
  );
}

function LoyersTable({ view, generatedOn }: { view: LoyersView; generatedOn: string }) {
  const { totals } = view;
  const stamp = generatedOn.split('-').reverse().join('/');
  return (
    <section aria-label="Détail par bien" className="rounded-lg border border-line bg-surface">
      <div className="relative overflow-x-auto">
        <DataTable caption="Détail des loyers par bien, en euros">
          <thead>
            <tr>
              <Th>Bien</Th>
              <Th>Locataire</Th>
              <Th numeric>Mois</Th>
              <Th numeric>Appelé</Th>
              <Th numeric>Encaissé</Th>
              <Th numeric>Reste dû</Th>
            </tr>
          </thead>
          <tbody>
            {view.groups.map((group) => (
              <GroupRows key={group.key} group={group} />
            ))}
            <tr className="bg-muted font-semibold">
              <th scope="row" className="h-9 px-2 text-left whitespace-nowrap">Total</th>
              <Td className="border-b-0">{plural(totals.tenants, 'locataire', 'locataires')}</Td>
              <Td numeric className="border-b-0" />
              <Td numeric strong className="border-b-0">{formatRoundedEuros(totals.called)}</Td>
              <Td numeric strong className="border-b-0">{formatRoundedEuros(totals.collected)}</Td>
              <Td numeric strong className="border-b-0">{formatRoundedEuros(totals.dueNet)}</Td>
            </tr>
          </tbody>
        </DataTable>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-line px-3 py-2 text-caption text-fg-subtle">
        <span>{`${plural(totals.lots, 'lot', 'lots')}, ${plural(totals.buildings, 'immeuble', 'immeubles')}`}</span>
        <span>{`Montants arrêtés au ${stamp}`}</span>
      </div>
    </section>
  );
}

function GroupRows({ group }: { group: LoyerGroup }) {
  return (
    <>
      {group.label ? (
        <tr className="bg-muted/60 font-semibold">
          <th scope="rowgroup" colSpan={3} className="h-9 px-2 text-left whitespace-nowrap">
            {group.label}
          </th>
          <Td numeric strong>{formatRoundedEuros(group.called)}</Td>
          <Td numeric strong>{formatRoundedEuros(group.collected)}</Td>
          <Td numeric strong>{formatRoundedEuros(group.due)}</Td>
        </tr>
      ) : null}
      {group.rows.map((row) => (
        <tr key={row.lot.id}>
          <th scope="row" className="h-9 border-b border-line px-2 text-left font-medium whitespace-nowrap">{row.lot.name}</th>
          <Td>{row.lot.tenantName}</Td>
          <Td numeric>{row.months}</Td>
          <Td numeric>{formatRoundedEuros(row.called)}</Td>
          <Td numeric>{formatRoundedEuros(row.collected)}</Td>
          <Td numeric className={row.due > 0 ? 'text-fg-danger' : undefined}>{formatRoundedEuros(row.due)}</Td>
        </tr>
      ))}
    </>
  );
}
