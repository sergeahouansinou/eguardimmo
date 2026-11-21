import type { Certificate } from '../../conformite/model';
import { conformitePaths } from '../../conformite/paths';
import { slotLabel } from '../../maintenance/labels';
import type { Intervention, VisitSummary } from '../../maintenance/model';
import { maintenancePaths } from '../../maintenance/paths';
import { agendaPaths } from '../agendaPaths';
import type { Occurrence, PlanningTask } from '../model';
import { localDateOf, localTimeOf } from '../../orgapi/zone';
import type { AgendaSource } from './labels';
import { KIND_LABELS } from './labels';

export interface AgendaItem {
  key: string;
  source: AgendaSource;
  date: string;
  time: string | null;
  title: string;
  label: string;
  href: string;
  alert: boolean;
}

export function occurrenceItem(occurrence: Occurrence, timeZone: string): AgendaItem {
  return {
    key: `event:${occurrence.eventId}:${occurrence.occurrenceOn}`,
    source: 'event',
    date: occurrence.startsAt ? localDateOf(occurrence.startsAt, timeZone) : occurrence.occurrenceOn,
    time: occurrence.startsAt ? localTimeOf(occurrence.startsAt, timeZone) : null,
    title: occurrence.title,
    label: KIND_LABELS[occurrence.kind],
    href: agendaPaths.event(occurrence.eventId),
    alert: false,
  };
}

export function taskItem(task: PlanningTask): AgendaItem {
  return {
    key: `task:${task.id}`,
    source: 'task',
    date: task.dueOn,
    time: null,
    title: task.title,
    label: task.isOverdue ? 'Tâche en retard' : 'Tâche',
    href: agendaPaths.task(task.id),
    alert: task.isOverdue,
  };
}

const FINISHED_INTERVENTIONS: readonly Intervention['status'][] = ['declined', 'cancelled', 'closed', 'completed', 'invoiced'];
const PLANNED_VISITS: readonly VisitSummary['status'][] = ['proposed', 'confirmed', 'reschedule_requested'];

export function interventionItems(intervention: Intervention): AgendaItem[] {
  if (FINISHED_INTERVENTIONS.includes(intervention.status)) return [];
  const href = maintenancePaths.intervention(intervention.id);
  const alert = intervention.priority === 'urgent';
  const visits = intervention.visits.filter((visit) => PLANNED_VISITS.includes(visit.status));
  if (visits.length > 0) {
    return visits.map((visit) => ({
      key: `intervention:${intervention.id}:visit:${visit.id}`,
      source: 'intervention',
      date: visit.scheduledOn,
      time: null,
      title: intervention.title,
      label: `Visite d’intervention · ${slotLabel[visit.slot].toLowerCase()}`,
      href,
      alert: alert || visit.status === 'reschedule_requested',
    }));
  }
  if (intervention.dueOn === null) return [];
  return [{ key: `intervention:${intervention.id}`, source: 'intervention', date: intervention.dueOn, time: null, title: intervention.title, label: 'Intervention à échéance', href, alert }];
}

export function certificateItem(certificate: Certificate): AgendaItem | null {
  if (certificate.expiresOn === null) return null;
  return {
    key: `certificate:${certificate.id}`,
    source: 'certificate',
    date: certificate.expiresOn,
    time: null,
    title: certificate.reference ? `${certificate.type.label} (${certificate.reference})` : certificate.type.label,
    label: certificate.state === 'expired' ? 'Certificat expiré' : 'Certificat à renouveler',
    href: conformitePaths.certificate(certificate.id),
    alert: certificate.state === 'expired',
  };
}

export function compareItems(a: AgendaItem, b: AgendaItem): number {
  if (a.time !== b.time) {
    if (a.time === null) return -1;
    if (b.time === null) return 1;
    return a.time < b.time ? -1 : 1;
  }
  return a.title.localeCompare(b.title, 'fr') || a.key.localeCompare(b.key);
}

export function groupByDay(items: readonly AgendaItem[], days: readonly string[]): Map<string, AgendaItem[]> {
  const grouped = new Map<string, AgendaItem[]>(days.map((day) => [day, []]));
  for (const item of items) grouped.get(item.date)?.push(item);
  for (const list of grouped.values()) list.sort(compareItems);
  return grouped;
}
