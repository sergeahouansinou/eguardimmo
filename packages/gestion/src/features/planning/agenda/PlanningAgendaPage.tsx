'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { LinkButton, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { QueryState } from '../../orgapi/QueryState';
import { ORG_ROOT, useOrgPermission, useOrgTimezone } from '../../orgapi/hooks';
import { useOrgInfoSource } from '../../orgapi/source';
import { todayIn, zoneLabel } from '../../orgapi/zone';
import { agendaPaths } from '../agendaPaths';
import { PLANNING_ROOT } from '../hooks';
import { AgendaToolbar } from './AgendaToolbar';
import { DayCells } from './DayCells';
import { isAgendaView, isIsoDate, periodLabel, rangeDays, shiftAnchor, viewRange } from './calendar';
import type { AgendaView } from './calendar';
import { AgendaFlows } from './flows';
import { groupByDay } from './items';
import type { AgendaSource } from './labels';
import { ALL_SOURCES, useAgendaData } from './useAgendaData';

const CRUMBS = [{ label: 'Accueil', href: links.home }, { label: 'Agenda' }] as const;

export function PlanningAgendaPage() {
  const timezone = useOrgTimezone();
  const { role } = useOrgInfoSource();
  const { Link } = useGestionNavigation();
  const permission = useOrgPermission('planning');
  const client = useQueryClient();
  return (
    <>
      <PageHeader
        crumbs={CRUMBS}
        title="Agenda"
        subtitle="Visites, rendez-vous, échéances, tâches, interventions et certificats à renouveler."
        actions={permission.write ? <LinkButton href={agendaPaths.newEvent} variant="primary" icon={Plus}>Nouvel événement</LinkButton> : null}
      />
      {timezone.data === undefined ? (
        <QueryState query={timezone} label="Chargement de l’agenda" title="Impossible de charger l’agenda" onRetry={() => { void client.invalidateQueries({ queryKey: ORG_ROOT }); }} />
      ) : (
        <>
          <AgendaBody timeZone={timezone.data} canWrite={permission.write} />
          <p className="text-caption text-fg-subtle">
            Dates et heures affichées dans le fuseau de l’organisation : {zoneLabel(timezone.data)}.{' '}
            {role === 'owner' || role === 'admin' ? <Link href={agendaPaths.timezone} className="text-action-on-subtle underline underline-offset-2">Modifier le fuseau horaire</Link> : null}
          </p>
        </>
      )}
    </>
  );
}

function initialState(search: URLSearchParams, today: string): { view: AgendaView; anchor: string } {
  const view = search.get('vue');
  const date = search.get('date');
  return { view: isAgendaView(view) ? view : 'mois', anchor: isIsoDate(date) ? date : today };
}

function AgendaBody({ timeZone, canWrite }: { timeZone: string; canWrite: boolean }) {
  const { search } = useGestionNavigation();
  const client = useQueryClient();
  const retry = () => { void client.invalidateQueries({ queryKey: PLANNING_ROOT }); };
  const today = todayIn(timeZone);
  const [state, setState] = useState(() => initialState(search, today));
  const [enabled, setEnabled] = useState<ReadonlySet<AgendaSource>>(new Set(ALL_SOURCES));
  const range = viewRange(state.view, state.anchor);
  const days = rangeDays(range);
  const data = useAgendaData(range, timeZone, enabled);

  const toggle = useCallback((source: AgendaSource) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (!next.delete(source)) next.add(source);
      return next;
    });
  }, []);

  const openDay = (day: string) => { setState({ view: 'jour', anchor: day }); };
  const failed = (enabled.has('event') && data.occurrences.isError) || (enabled.has('task') && data.tasks.isError);
  const loading = (enabled.has('event') && data.occurrences.isPending && !data.occurrences.isError) || (enabled.has('task') && data.tasks.isPending && !data.tasks.isError);

  return (
    <Card role="region" aria-label="Agenda" className="gap-3">
      <AgendaToolbar
        view={state.view}
        title={periodLabel(state.view, state.anchor)}
        enabled={enabled}
        onView={(view) => { setState((current) => ({ ...current, view })); }}
        onPrevious={() => { setState((current) => ({ ...current, anchor: shiftAnchor(current.view, current.anchor, -1) })); }}
        onNext={() => { setState((current) => ({ ...current, anchor: shiftAnchor(current.view, current.anchor, 1) })); }}
        onToday={() => { setState((current) => ({ ...current, anchor: today })); }}
        onToggle={toggle}
      />
      <AgendaFlows range={range} enabled={enabled} report={data.report} />
      {enabled.has('event') && data.occurrences.isError ? (
        <QueryState query={data.occurrences} label="Chargement des événements" title="Impossible de charger les événements" onRetry={retry} />
      ) : null}
      {enabled.has('task') && data.tasks.isError ? (
        <QueryState query={data.tasks} label="Chargement des tâches" title="Impossible de charger les tâches" onRetry={retry} />
      ) : null}
      {data.tasksTruncated ? <Alert tone="info" title="Période chargée en partie">Seules les 100 premières tâches de la période sont affichées : réduisez la période pour les voir toutes.</Alert> : null}
      {loading && !failed ? <p role="status" aria-busy="true" className="py-2 text-body text-fg-subtle">Chargement de la période…</p> : null}
      {state.view === 'jour' && !failed ? (
        <div className="flex flex-wrap justify-end gap-2">
          {canWrite ? <LinkButton href={agendaPaths.newEventOn(state.anchor)} size="sm" icon={Plus}>Ajouter un événement ce jour</LinkButton> : null}
          <Button variant="ghost" size="sm" onClick={() => { setState((current) => ({ ...current, view: 'mois' })); }}>Retour au mois</Button>
        </div>
      ) : null}
      <DayCells view={state.view} days={days} items={groupByDay(data.items, days)} today={today} anchor={state.anchor} onOpenDay={openDay} />
    </Card>
  );
}
