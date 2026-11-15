import { bienLabel, bienShort, matchesBien } from '../shared/biens';
import type { BienId } from '../shared/biens';
import { addDays, addMonthsClamped } from '../shared/dates';
import type { Intervention } from '../interventions/schemas';
import type { Task } from '../taches/schemas';
import type { AgendaEvent, Echeance, EventKind } from './schemas';

export const AGENDA_CATEGORIES = ['locations', 'interventions', 'taches', 'contrats', 'anniversaires'] as const;
export type AgendaCategory = (typeof AGENDA_CATEGORIES)[number];

export const categoryLabels: Record<AgendaCategory, string> = {
  locations: 'Locations',
  interventions: 'Interventions',
  taches: 'Tâches',
  contrats: 'Contrats et diagnostics',
  anniversaires: 'Anniversaires',
};

export const categorySwatch: Record<AgendaCategory, string> = {
  locations: 'bg-action',
  interventions: 'bg-accent',
  taches: 'bg-warning-line',
  contrats: 'bg-line-strong',
  anniversaires: 'bg-danger-solid',
};

export const categoryBorder: Record<AgendaCategory, string> = {
  locations: 'border-l-action',
  interventions: 'border-l-accent',
  taches: 'border-l-warning-line',
  contrats: 'border-l-line-strong',
  anniversaires: 'border-l-danger-solid',
};

export const categoryTone: Record<AgendaCategory, 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  locations: 'info',
  interventions: 'success',
  taches: 'warning',
  contrats: 'neutral',
  anniversaires: 'danger',
};

const categoryOfKind: Record<EventKind, AgendaCategory> = {
  visite: 'locations',
  rendez_vous: 'locations',
  echeance: 'locations',
  intervention: 'interventions',
  rappel: 'taches',
  contrat: 'contrats',
  anniversaire: 'anniversaires',
};

export interface AgendaEntry {
  key: string;
  date: string;
  time: string | null;
  title: string;
  detail: string;
  category: AgendaCategory;
  bienId: BienId | null;
}

const MAX_OCCURRENCES = 1000;

function occurrences(event: AgendaEvent, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const date =
      event.recurrence === 'aucune'
        ? event.date
        : event.recurrence === 'hebdomadaire'
          ? addDays(event.date, step * 7)
          : addMonthsClamped(event.date, event.recurrence === 'mensuelle' ? step : step * 12);
    if (date > to) break;
    if (date >= from) dates.push(date);
    if (event.recurrence === 'aucune') break;
  }
  return dates;
}

export function buildEntries(
  input: { events: readonly AgendaEvent[]; echeances: readonly Echeance[]; interventions: readonly Intervention[]; tasks: readonly Task[] },
  from: string,
  to: string,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  for (const event of input.events) {
    for (const date of occurrences(event, from, to)) {
      entries.push({
        key: `evenement:${event.id}:${date}`,
        date,
        time: event.time,
        title: event.title,
        detail: event.bienId ? bienLabel(event.bienId) : event.invitees.join(', '),
        category: categoryOfKind[event.kind],
        bienId: event.bienId,
      });
    }
  }
  for (const echeance of input.echeances) {
    if (echeance.date < from || echeance.date > to) continue;
    entries.push({
      key: `echeance:${echeance.id}`,
      date: echeance.date,
      time: echeance.time,
      title: echeance.title,
      detail: echeance.detail,
      category: 'locations',
      bienId: echeance.bienId,
    });
  }
  for (const item of input.interventions) {
    if (item.archived || item.status === 'terminee' || item.dueDate === null || item.dueDate < from || item.dueDate > to) continue;
    entries.push({
      key: `intervention:${item.id}`,
      date: item.dueDate,
      time: null,
      title: item.subject,
      detail: `${bienLabel(item.bienId)} · ${item.intervenant ?? 'À assigner'}`,
      category: 'interventions',
      bienId: item.bienId,
    });
  }
  for (const task of input.tasks) {
    if (task.done || task.dueDate < from || task.dueDate > to) continue;
    entries.push({
      key: `tache:${task.id}`,
      date: task.dueDate,
      time: null,
      title: task.title,
      detail: `${bienShort(task.bienId)} · ${task.assignee}`,
      category: 'taches',
      bienId: task.bienId,
    });
  }
  return entries.sort(compareEntries);
}

export function compareEntries(a: AgendaEntry, b: AgendaEntry): number {
  return a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title, 'fr');
}

export function filterEntries(entries: readonly AgendaEntry[], categories: readonly AgendaCategory[], bien: string): AgendaEntry[] {
  return entries.filter((entry) => categories.includes(entry.category) && matchesBien(entry.bienId, bien));
}

export function groupByDate(entries: readonly AgendaEntry[]): Map<string, AgendaEntry[]> {
  const groups = new Map<string, AgendaEntry[]>();
  for (const entry of entries) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
  return groups;
}

export const entryDetail = (entry: AgendaEntry): string =>
  [entry.detail, entry.time].filter((part): part is string => part !== null && part !== '').join(' · ');
