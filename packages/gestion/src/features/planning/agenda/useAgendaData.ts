'use client';

import { useCallback, useMemo, useState } from 'react';
import { useOccurrences, useTasks } from '../hooks';
import type { DateRange } from './calendar';
import type { FlowReport } from './flows';
import { occurrenceItem, taskItem } from './items';
import type { AgendaItem } from './items';
import type { AgendaSource } from './labels';

const TASK_PAGE_SIZE = 100;

export const ALL_SOURCES: readonly AgendaSource[] = ['event', 'task', 'intervention', 'certificate'];

export function useAgendaData(range: DateRange, timeZone: string, enabled: ReadonlySet<AgendaSource>) {
  const occurrences = useOccurrences(range.from, range.to, enabled.has('event'));
  const tasks = useTasks({ status: 'open', dueFrom: range.from, dueTo: range.to, perPage: TASK_PAGE_SIZE }, enabled.has('task'));
  const [reports, setReports] = useState<Readonly<Partial<Record<AgendaSource, FlowReport>>>>({});
  const report = useCallback((source: AgendaSource, next: FlowReport) => { setReports((current) => ({ ...current, [source]: next })); }, []);

  const items = useMemo(() => {
    const collected: AgendaItem[] = [];
    if (enabled.has('event')) collected.push(...(occurrences.data ?? []).map((occurrence) => occurrenceItem(occurrence, timeZone)));
    if (enabled.has('task')) collected.push(...(tasks.data?.items ?? []).map(taskItem));
    for (const source of ['intervention', 'certificate'] as const) {
      if (enabled.has(source)) collected.push(...(reports[source]?.items ?? []));
    }
    return collected;
  }, [enabled, occurrences.data, tasks.data, reports, timeZone]);

  return { occurrences, tasks, items, report, tasksTruncated: tasks.data?.nextCursor != null };
}
