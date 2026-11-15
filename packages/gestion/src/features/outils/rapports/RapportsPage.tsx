'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, Star } from 'lucide-react';
import { Badge, Button, Icon, TextField, cx } from '@eguardimmo/ui';
import { DataTable, EmptyBlock, FilterChip, PageHeader, QueryState, Td, Th, slugify } from '../kit';
import type { ScreenProps } from '../kit';
import { downloadCsv } from '../analytique/csv';
import { formatStamp } from '../analytique/format';
import { REPORT_GROUPS, reportHref } from './catalog';
import type { ReportType } from './catalog';
import { SchedulesDialog } from './SchedulesDialog';
import type { HistoryEntry } from './schemas';
import { useOverview, useToggleFavorite } from './source';

type Scope = 'all' | 'favorites' | 'fiscal';

const normalize = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function downloadHistory(entry: HistoryEntry): void {
  downloadCsv(`${slugify(entry.label)}-${entry.generatedAt.slice(0, 10)}`, {
    columns: ['Rapport', 'Période', 'Biens', 'Généré le', 'Format'],
    rows: [[entry.label, entry.period, entry.scope, formatStamp(entry.generatedAt), entry.format]],
  });
}

const FORMAT_ACTION: Record<HistoryEntry['format'], string> = { PDF: 'Aperçu PDF', CSV: 'Télécharger', Excel: 'Télécharger' };

export function RapportsPage({ Link, navigate }: ScreenProps) {
  const query = useOverview();
  const toggle = useToggleFavorite();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [schedulesOpen, setSchedulesOpen] = useState(false);

  const groups = useMemo(() => {
    const favorites = new Set(query.data?.favorites ?? []);
    const needle = normalize(search.trim());
    const matches = (report: ReportType): boolean =>
      (scope === 'all' || (scope === 'favorites' ? favorites.has(report.slug) : report.fiscal)) &&
      (needle === '' || normalize(`${report.label} ${report.description} ${report.group}`).includes(needle));
    return REPORT_GROUPS.map((group) => ({ label: group.label, reports: group.reports.filter(matches) })).filter((group) => group.reports.length > 0);
  }, [query.data, search, scope]);

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Rapports' }]}
        title="Rapports"
        description="Choisissez un rapport, réglez la période et les biens, puis prévisualisez le PDF ou exportez en Excel."
        actions={
          <Button variant="secondary" onClick={() => { setSchedulesOpen(true); }}>
            <Icon icon={CalendarClock} />
            Envois programmés
          </Button>
        }
      />
      <QueryState query={query} errorTitle="Les rapports n’ont pas pu être chargés">
        {(data) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[280px]">
                <TextField
                  type="search"
                  label="Chercher un rapport"
                  hideLabel
                  placeholder="Ex. loyers, charges, fiscalité"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); }}
                />
              </div>
              <FilterChip pressed={scope === 'all'} onPressedChange={() => { setScope('all'); }}>Tous</FilterChip>
              <FilterChip pressed={scope === 'favorites'} onPressedChange={(on) => { setScope(on ? 'favorites' : 'all'); }}>Favoris</FilterChip>
              <FilterChip pressed={scope === 'fiscal'} onPressedChange={(on) => { setScope(on ? 'fiscal' : 'all'); }}>Fiscalité</FilterChip>
            </div>
            {groups.length === 0 ? (
              <EmptyBlock
                title="Aucun rapport trouvé"
                action={
                  <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setScope('all'); }}>
                    Réinitialiser la recherche
                  </Button>
                }
              >
                Aucun rapport ne correspond à votre recherche.
              </EmptyBlock>
            ) : (
              groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="flex flex-col gap-1.5">
                  <h2 className="text-block-title">{group.label}</h2>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.reports.map((report) => {
                      const favorite = data.favorites.includes(report.slug);
                      return (
                        <li key={report.slug} className="relative">
                          <Link
                            href={reportHref(report.slug)}
                            className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface py-2.5 pr-14 pl-3 hover:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          >
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-action-subtle text-action-on-subtle">
                              <Icon icon={report.icon} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <b className="truncate text-body-strong text-fg">{report.label}</b>
                              <span className="truncate text-caption text-fg-muted">{report.description}</span>
                            </span>
                          </Link>
                          <button
                            type="button"
                            aria-pressed={favorite}
                            aria-label={`${favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${report.label}`}
                            onClick={() => { toggle.mutate(report.slug); }}
                            className="absolute top-1/2 right-7 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus"
                          >
                            <Icon icon={Star} className={cx(favorite ? 'fill-current text-warning-line' : 'text-fg-subtle')} />
                          </button>
                          <Icon icon={ChevronRight} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-subtle" />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
            <HistoryCard history={data.history} navigate={navigate} />
            <SchedulesDialog open={schedulesOpen} onOpenChange={setSchedulesOpen} schedules={data.schedules} />
          </>
        )}
      </QueryState>
    </>
  );
}

function HistoryCard({ history, navigate }: { history: readonly HistoryEntry[]; navigate: ScreenProps['navigate'] }) {
  return (
    <section aria-labelledby="rapports-historique" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="rapports-historique" className="text-block-title">
          Derniers rapports générés
        </h2>
        <span className="text-caption text-fg-subtle">Conservés 12 mois</span>
      </div>
      <div className="relative overflow-x-auto">
        <DataTable caption="Derniers rapports générés">
          <thead>
            <tr>
              <Th>Rapport</Th>
              <Th>Période</Th>
              <Th>Biens</Th>
              <Th>Généré le</Th>
              <Th>Format</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <th scope="row" className="h-11 border-b border-line px-2 text-left font-medium whitespace-nowrap">{entry.label}</th>
                <Td>{entry.period}</Td>
                <Td>{entry.scope}</Td>
                <Td>{formatStamp(entry.generatedAt).replace(', ', ' ')}</Td>
                <Td><Badge tone="neutral">{entry.format}</Badge></Td>
                <Td>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      if (entry.format === 'PDF') navigate(`${reportHref(entry.slug)}/apercu`);
                      else downloadHistory(entry);
                    }}
                  >
                    {`${FORMAT_ACTION[entry.format]} `}
                    <span className="sr-only">{entry.label}</span>
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </section>
  );
}
