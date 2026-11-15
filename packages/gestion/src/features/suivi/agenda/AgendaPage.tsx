'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CardTitle, IconButton } from '@eguardimmo/ui';
import { DEMO_MONTH, DEMO_TODAY, EmptyBlock, ErrorBlock, FilterChip, LoadingBlock, PageHeader, Segmented } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { ALL, bienOptions } from '../shared/biens';
import { addDays, addMonths, daysInMonth, formatDayHeading, formatDayMonthShort, formatMonthTitle, monthWeeks, yearMonthOf } from '../shared/dates';
import { FilterSelect } from '../shared/ui';
import { AGENDA_CATEGORIES, categoryLabels, categorySwatch, categoryTone, entryDetail, filterEntries, groupByDate } from './calendar';
import type { AgendaCategory, AgendaEntry } from './calendar';
import { IcalDialog } from './IcalDialog';
import { MonthGrid } from './MonthGrid';
import { useAgendaEntries } from './source';

type View = 'mois' | 'liste';

const VIEWS = [
  { value: 'mois', label: 'Mois' },
  { value: 'liste', label: 'Liste' },
] as const;

const UPCOMING_COUNT = 8;
const UPCOMING_WINDOW_DAYS = 120;

function EntryRow({ entry, lead }: { entry: AgendaEntry; lead: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
      <Badge tone={categoryTone[entry.category]} className="min-w-[52px] justify-center">{lead}</Badge>
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-body-strong text-fg">{entry.title}</b>
        <span className="truncate text-caption text-fg-subtle">{entryDetail(entry)}</span>
      </div>
    </li>
  );
}

export function AgendaPage({ Link }: ScreenProps) {
  const agenda = useAgendaEntries();
  const [month, setMonth] = useState(DEMO_MONTH);
  const [view, setView] = useState<View>('mois');
  const [categories, setCategories] = useState<readonly AgendaCategory[]>(['locations', 'interventions', 'taches']);
  const [bien, setBien] = useState(ALL);
  const [focused, setFocused] = useState(DEMO_TODAY);
  const [icalOpen, setIcalOpen] = useState(false);

  const weeks = monthWeeks(month);
  const gridStart = weeks[0]?.[0] ?? `${month}-01`;
  const gridEnd = weeks.at(-1)?.[6] ?? `${month}-28`;
  const monthEntries = filterEntries(agenda.entries(gridStart, gridEnd), categories, bien);
  const byDate = groupByDate(monthEntries);
  const listDays = [...byDate.keys()].filter((date) => yearMonthOf(date) === month);
  const upcoming = filterEntries(agenda.entries(DEMO_TODAY, addDays(DEMO_TODAY, UPCOMING_WINDOW_DAYS)), categories, bien).slice(0, UPCOMING_COUNT);

  const goTo = (target: string) => {
    setFocused(target);
    setMonth(yearMonthOf(target));
  };
  const shift = (months: number) => {
    const next = addMonths(month, months);
    setMonth(next);
    setFocused(`${next}-${String(Math.min(Number(focused.slice(8)), daysInMonth(next))).padStart(2, '0')}`);
  };
  const toggleCategory = (category: AgendaCategory) => {
    setCategories((current) => (current.includes(category) ? current.filter((item) => item !== category) : [...current, category]));
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Agenda' }]}
        title="Agenda"
        description={`${formatMonthTitle(month)}. Les échéances de loyer et les interventions apparaissent automatiquement.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setIcalOpen(true); }}>Lien iCal</Button>
            <Button asChild>
              <Link href="/agenda/nouveau">Nouvel événement</Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label="Mois précédent" icon={ChevronLeft} variant="secondary" onClick={() => { shift(-1); }} />
          <span className="min-w-36 text-center text-block-title" aria-live="polite">{formatMonthTitle(month)}</span>
          <IconButton label="Mois suivant" icon={ChevronRight} variant="secondary" onClick={() => { shift(1); }} />
          <Button variant="secondary" size="sm" onClick={() => { goTo(DEMO_TODAY); }}>Aujourd’hui</Button>
        </div>
        <Segmented label="Affichage" options={VIEWS} value={view} onValueChange={setView} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1.5 pb-0.5" role="group" aria-label="Types d’événements">
          {AGENDA_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              pressed={categories.includes(category)}
              onPressedChange={() => { toggleCategory(category); }}
              swatch={categorySwatch[category]}
            >
              {categoryLabels[category]}
            </FilterChip>
          ))}
        </div>
        <FilterSelect label="Bien" allLabel="Bien : Tous" options={bienOptions()} value={bien} onValueChange={setBien} className="sm:ml-auto sm:w-52" />
      </div>

      {agenda.isError ? (
        <ErrorBlock title="L’agenda n’a pas pu être chargé" onRetry={agenda.refetch} />
      ) : !agenda.isReady ? (
        <LoadingBlock label="Chargement de l’agenda" />
      ) : view === 'mois' ? (
        <MonthGrid month={month} today={DEMO_TODAY} focused={focused} entries={byDate} onFocusedChange={goTo} />
      ) : (
        <Card role="region" aria-label={`Événements de ${formatMonthTitle(month)}`}>
          {listDays.length === 0 ? (
            <EmptyBlock title="Aucun événement ce mois-ci">Modifiez les types ou le bien, ou créez un événement.</EmptyBlock>
          ) : (
            listDays.map((date) => (
              <section key={date} aria-label={formatDayHeading(date)}>
                <h3 className="pt-2 text-body-strong text-fg">{formatDayHeading(date)}</h3>
                <ul>
                  {(byDate.get(date) ?? []).map((entry) => (
                    <EntryRow key={entry.key} entry={entry} lead={formatDayMonthShort(date)} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </Card>
      )}

      {agenda.isReady && view === 'mois' ? (
        <Card role="region" aria-labelledby="agenda-a-venir">
          <CardTitle as="h2" id="agenda-a-venir">À venir</CardTitle>
          {upcoming.length === 0 ? (
            <p className="text-body text-fg-muted">Aucun événement à venir pour ces filtres.</p>
          ) : (
            <ul>
              {upcoming.map((entry) => (
                <EntryRow key={entry.key} entry={entry} lead={formatDayMonthShort(entry.date)} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}
      <IcalDialog open={icalOpen} onOpenChange={setIcalOpen} />
    </>
  );
}
