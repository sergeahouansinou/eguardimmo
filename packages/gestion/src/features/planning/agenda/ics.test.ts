import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldIcsLine } from './ics';
import { planningEvent } from './testing';

const NOW = new Date('2026-11-01T08:00:00Z');
const lines = (text: string): string[] => text.split('\r\n');

describe('export .ics', () => {
  it('produit un événement ponctuel en UTC avec son rappel', () => {
    const ics = buildIcs(planningEvent({ recurrence: 'none' }), 'Europe/Paris', NOW);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(lines(ics)).toEqual(expect.arrayContaining(['BEGIN:VCALENDAR', 'DTSTART:20261121T130000Z', 'DTEND:20261121T140000Z', 'TRIGGER:-PT60M', 'END:VCALENDAR', 'SUMMARY:Visite appartement 12']));
    expect(ics).toContain('DTSTAMP:20261101T080000Z');
  });

  it('applique l’heure d’été dans l’instant exporté', () => {
    const ics = buildIcs(planningEvent({ startsOn: '2026-07-14', startTime: '14:00', recurrence: 'none' }), 'Europe/Paris', NOW);
    expect(ics).toContain('DTSTART:20260714T120000Z');
  });

  it('garde le fuseau de l’événement pour une série et borne la fin en UTC', () => {
    const ics = buildIcs(planningEvent({ recurrence: 'weekly', recurrenceUntil: '2026-12-31' }), 'Europe/Paris', NOW);
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261121T140000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20261121T150000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20261231T225900Z');
  });

  it('exporte un événement sur la journée avec une date de fin exclusive', () => {
    const ics = buildIcs(planningEvent({ allDay: true, startTime: null, timezone: null, startsOn: '2026-12-31', recurrence: 'yearly', recurrenceUntil: null }), 'Europe/Paris', NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
    expect(ics).toContain('RRULE:FREQ=YEARLY');
  });

  it('échappe les caractères spéciaux et plie les longues lignes', () => {
    expect(escapeIcsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
    const folded = foldIcsLine(`DESCRIPTION:${'é'.repeat(100)}`);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replaceAll('\r\n ', '')).toBe(`DESCRIPTION:${'é'.repeat(100)}`);
  });

  it('ne laisse pas un retour chariot isolé injecter une propriété', () => {
    const ics = buildIcs(planningEvent({ title: 'Réunion\rATTACH:https://evil/x', notes: 'ligne\r\nURL:https://evil/y' }), 'Europe/Paris', NOW);
    const lines = ics.split('\r\n');
    expect(lines.some((line) => line.startsWith('ATTACH:') || line.startsWith('URL:'))).toBe(false);
    expect(lines).toContain('SUMMARY:Réunion\\nATTACH:https://evil/x');
    expect(lines).toContain('DESCRIPTION:ligne\\nURL:https://evil/y');
  });

  it('marque un événement annulé', () => {
    expect(buildIcs(planningEvent({ cancelledAt: '2026-11-02T10:00:00Z' }), 'Europe/Paris', NOW)).toContain('STATUS:CANCELLED');
  });
});
