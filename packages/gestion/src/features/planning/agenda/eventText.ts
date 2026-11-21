import { formatDateTimeFr } from '../../orgapi/zone';
import type { PlanningEvent } from '../model';
import { fullDayLabel } from './calendar';
import { RECURRENCE_LABELS } from './labels';
import { zonedInstant } from './zoned';

export function eventStartLabel(event: PlanningEvent, orgTimeZone: string): string {
  if (event.startTime === null) return `${fullDayLabel(event.startsOn)}, toute la journée`;
  const zone = event.timezone ?? orgTimeZone;
  return formatDateTimeFr(zonedInstant(event.startsOn, event.startTime, zone).toISOString(), orgTimeZone);
}

export function eventZoneNote(event: PlanningEvent, orgTimeZone: string): string | null {
  if (event.startTime === null || event.timezone === null || event.timezone === orgTimeZone) return null;
  return `Saisi à ${event.startTime.slice(0, 5)} (${event.timezone.replace('_', ' ')}).`;
}

export function recurrenceLabel(event: PlanningEvent): string {
  if (event.recurrence === 'none') return RECURRENCE_LABELS.none;
  const base = RECURRENCE_LABELS[event.recurrence];
  return event.recurrenceUntil === null ? `${base}, sans date de fin` : `${base}, jusqu’au ${fullDayLabel(event.recurrenceUntil)}`;
}
