import { saveBlob } from '../../finances/rent/download';
import type { PlanningEvent } from '../model';
import { addDaysIso } from './calendar';
import { zonedInstant } from './zoned';

const FREQUENCIES = { weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as const;
const DEFAULT_DURATION_MS = 3_600_000;
const MAX_LINE_BYTES = 75;

const compactDate = (iso: string): string => iso.replaceAll('-', '');

const compactUtc = (instant: Date): string => `${instant.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '')}Z`;

const compactLocal = (date: string, time: string): string => `${compactDate(date)}T${time.replace(':', '')}00`;

export function escapeIcsText(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = chunks.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1;
    if (bytes + size > limit) {
      chunks.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  chunks.push(current);
  return chunks.join('\r\n ');
}

function startLines(event: PlanningEvent, fallbackZone: string): string[] {
  if (event.startTime === null) {
    return [`DTSTART;VALUE=DATE:${compactDate(event.startsOn)}`, `DTEND;VALUE=DATE:${compactDate(addDaysIso(event.startsOn, 1))}`];
  }
  const zone = event.timezone ?? fallbackZone;
  const start = zonedInstant(event.startsOn, event.startTime, zone);
  if (event.recurrence === 'none') {
    return [`DTSTART:${compactUtc(start)}`, `DTEND:${compactUtc(new Date(start.getTime() + DEFAULT_DURATION_MS))}`];
  }
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const endLocal = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(end);
  const field = (type: string): string => endLocal.find((part) => part.type === type)?.value ?? '';
  return [
    `DTSTART;TZID=${zone}:${compactLocal(event.startsOn, event.startTime)}`,
    `DTEND;TZID=${zone}:${field('year')}${field('month')}${field('day')}T${field('hour')}${field('minute')}00`,
  ];
}

function recurrenceLines(event: PlanningEvent, fallbackZone: string): string[] {
  if (event.recurrence === 'none') return [];
  const until = event.recurrenceUntil;
  let untilPart = '';
  if (until !== null) {
    untilPart = event.startTime === null ? `;UNTIL=${compactDate(until)}` : `;UNTIL=${compactUtc(zonedInstant(until, '23:59', event.timezone ?? fallbackZone))}`;
  }
  return [`RRULE:FREQ=${FREQUENCIES[event.recurrence]}${untilPart}`];
}

export function buildIcs(event: PlanningEvent, fallbackZone: string, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//eGuardImmo//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@eguardimmo`,
    `DTSTAMP:${compactUtc(now)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.notes ? [`DESCRIPTION:${escapeIcsText(event.notes)}`] : []),
    ...startLines(event, fallbackZone),
    ...recurrenceLines(event, fallbackZone),
    ...(event.cancelledAt === null ? [] : ['STATUS:CANCELLED']),
    ...(event.reminderOffsetMinutes === null
      ? []
      : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcsText(event.title)}`, `TRIGGER:-PT${String(event.reminderOffsetMinutes)}M`, 'END:VALARM']),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function downloadIcs(event: PlanningEvent, fallbackZone: string): void {
  saveBlob(new Blob([buildIcs(event, fallbackZone)], { type: 'text/calendar;charset=utf-8' }), `evenement-${event.startsOn}.ics`);
}
