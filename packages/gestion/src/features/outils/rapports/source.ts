'use client';

import { createSourceContext, nextId, useScreenQuery, useSourceMutation } from '../kit';
import { createDemoLoyers, createDemoOverview } from './demo';
import { createDemoReportsData } from './engine/demoData';
import { reportsDataSchema } from './engine/data';
import { emailFormSchema, loyersDataSchema, overviewSchema, scheduleFormSchema } from './schemas';
import type { EmailInput, Overview, ScheduleInput } from './schemas';

export interface RapportsSource {
  loadOverview: () => Promise<unknown>;
  loadLoyers: () => Promise<unknown>;
  loadReportsData: () => Promise<unknown>;
  toggleFavorite: (slug: string) => Promise<void>;
  addSchedule: (input: ScheduleInput) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  sendEmail: (input: EmailInput) => Promise<void>;
}

const NEXT_RUN = { weekly: '2026-11-20', monthly: '2026-12-01', quarterly: '2027-01-01' } as const;

export function createDemoRapportsSource(): RapportsSource {
  let overview: Overview = createDemoOverview();
  const loyers = createDemoLoyers();
  const reports = createDemoReportsData();
  return {
    loadOverview: () => Promise.resolve(structuredClone(overview)),
    loadLoyers: () => Promise.resolve(structuredClone(loyers)),
    loadReportsData: () => Promise.resolve(structuredClone(reports)),
    toggleFavorite: (slug) => {
      const favorites = overview.favorites.includes(slug) ? overview.favorites.filter((item) => item !== slug) : [...overview.favorites, slug];
      overview = { ...overview, favorites };
      return Promise.resolve();
    },
    addSchedule: (input) => {
      const { recipient, frequency } = scheduleFormSchema.parse(input);
      const schedule = { id: nextId('s'), slug: input.slug, label: input.label, recipient, frequency, nextRun: NEXT_RUN[frequency] };
      overview = { ...overview, schedules: [...overview.schedules, schedule] };
      return Promise.resolve();
    },
    removeSchedule: (id) => {
      overview = { ...overview, schedules: overview.schedules.filter((schedule) => schedule.id !== id) };
      return Promise.resolve();
    },
    sendEmail: (input) => {
      emailFormSchema.parse(input);
      return Promise.resolve();
    },
  };
}

const context = createSourceContext<RapportsSource>(createDemoRapportsSource);

export const RapportsSourceProvider = context.Provider;
export const useRapportsSource = context.useSource;
export const resetRapportsSource = context.resetDefault;

export const OVERVIEW_KEY = ['outils', 'rapports', 'overview'] as const;
export const LOYERS_KEY = ['outils', 'rapports', 'loyers'] as const;
export const REPORTS_KEY = ['outils', 'rapports', 'donnees'] as const;

export function useOverview() {
  const source = useRapportsSource();
  return useScreenQuery(OVERVIEW_KEY, () => source.loadOverview(), overviewSchema);
}

export function useLoyersData() {
  const source = useRapportsSource();
  return useScreenQuery(LOYERS_KEY, () => source.loadLoyers(), loyersDataSchema);
}

export function useReportsData() {
  const source = useRapportsSource();
  return useScreenQuery(REPORTS_KEY, () => source.loadReportsData(), reportsDataSchema);
}

export function useToggleFavorite() {
  const source = useRapportsSource();
  return useSourceMutation((slug: string) => source.toggleFavorite(slug), [OVERVIEW_KEY]);
}

export function useAddSchedule() {
  const source = useRapportsSource();
  return useSourceMutation((input: ScheduleInput) => source.addSchedule(input), [OVERVIEW_KEY]);
}

export function useRemoveSchedule() {
  const source = useRapportsSource();
  return useSourceMutation((id: string) => source.removeSchedule(id), [OVERVIEW_KEY]);
}

export function useSendEmail() {
  const source = useRapportsSource();
  return useSourceMutation((input: EmailInput) => source.sendEmail(input), []);
}
