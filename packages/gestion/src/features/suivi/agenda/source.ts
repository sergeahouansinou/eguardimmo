'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import type { ScreenQuery } from '../../outils/kit';
import { useInterventions } from '../interventions/source';
import { useTasks } from '../taches/source';
import { buildEntries } from './calendar';
import type { AgendaEntry } from './calendar';
import { createDemoAgendaSource } from './demo';
import { echeanceListSchema, eventListSchema } from './schemas';
import type { AgendaEvent, Echeance, EventInput } from './schemas';

export interface AgendaSource {
  listEvents: () => Promise<unknown>;
  listEcheances: () => Promise<unknown>;
  createEvent: (draft: EventInput) => Promise<unknown>;
  icalUrl: () => Promise<string>;
}

const context = createSourceContext(createDemoAgendaSource);

export const AgendaSourceProvider = context.Provider;
export const useAgendaSource = context.useSource;
export const resetAgendaDemo = context.resetDefault;

export const EVENTS_KEY = ['suivi', 'agenda', 'evenements'] as const;
export const ECHEANCES_KEY = ['suivi', 'agenda', 'echeances'] as const;
export const ICAL_KEY = ['suivi', 'agenda', 'ical'] as const;

export function useAgendaEvents(): ScreenQuery<AgendaEvent[]> {
  const source = useAgendaSource();
  return useScreenQuery(EVENTS_KEY, source.listEvents, eventListSchema);
}

export function useEcheances(): ScreenQuery<Echeance[]> {
  const source = useAgendaSource();
  return useScreenQuery(ECHEANCES_KEY, source.listEcheances, echeanceListSchema);
}

export interface AgendaQuery {
  entries: (from: string, to: string) => AgendaEntry[];
  isError: boolean;
  isReady: boolean;
  refetch: () => void;
}

export function useAgendaEntries(): AgendaQuery {
  const events = useAgendaEvents();
  const echeances = useEcheances();
  const interventions = useInterventions();
  const tasks = useTasks();
  const ready = events.data && echeances.data && interventions.data && tasks.data;
  return {
    entries: (from, to) =>
      ready
        ? buildEntries({ events: events.data ?? [], echeances: echeances.data ?? [], interventions: interventions.data ?? [], tasks: tasks.data ?? [] }, from, to)
        : [],
    isError: events.isError || echeances.isError || interventions.isError || tasks.isError,
    isReady: Boolean(ready),
    refetch: () => {
      events.refetch();
      echeances.refetch();
      interventions.refetch();
      tasks.refetch();
    },
  };
}
