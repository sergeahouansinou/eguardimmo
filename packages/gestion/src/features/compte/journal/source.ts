'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import { demoJournalEvents } from './demo';
import { journalEventsSchema } from './schemas';
import type { JournalEvent } from './schemas';

export interface JournalSource {
  listEvents: () => Promise<JournalEvent[]>;
}

export function createDemoJournalSource(): JournalSource {
  const events = demoJournalEvents();
  return { listEvents: () => Promise.resolve(structuredClone(events)) };
}

const context = createSourceContext<JournalSource>(createDemoJournalSource);

export const JournalSourceProvider = context.Provider;
export const useJournalSource = context.useSource;
export const resetJournalDemo = context.resetDefault;

export const journalKeys = { events: ['compte', 'journal', 'evenements'] as const };

export function useJournalEvents() {
  const source = useJournalSource();
  return useScreenQuery(journalKeys.events, () => source.listEvents(), journalEventsSchema);
}
