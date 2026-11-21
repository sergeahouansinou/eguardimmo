import { describe, expect, it } from 'vitest';
import { localDateOf, localTimeOf } from '../../orgapi/zone';
import { offsetMinutes, zonedInstant } from './zoned';

describe('conversion heure locale vers instant', () => {
  it('applique l’heure d’hiver et l’heure d’été à Paris', () => {
    expect(zonedInstant('2026-03-28', '12:00', 'Europe/Paris').toISOString()).toBe('2026-03-28T11:00:00.000Z');
    expect(zonedInstant('2026-03-29', '12:00', 'Europe/Paris').toISOString()).toBe('2026-03-29T10:00:00.000Z');
    expect(zonedInstant('2026-10-24', '12:00', 'Europe/Paris').toISOString()).toBe('2026-10-24T10:00:00.000Z');
    expect(zonedInstant('2026-10-25', '12:00', 'Europe/Paris').toISOString()).toBe('2026-10-25T11:00:00.000Z');
  });

  it('gère le jour du changement d’heure avant et après la bascule', () => {
    expect(zonedInstant('2026-03-29', '01:30', 'Europe/Paris').toISOString()).toBe('2026-03-29T00:30:00.000Z');
    expect(zonedInstant('2026-03-29', '03:30', 'Europe/Paris').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('gère un fuseau d’outre-Atlantique', () => {
    expect(zonedInstant('2026-11-21', '09:00', 'America/Toronto').toISOString()).toBe('2026-11-21T14:00:00.000Z');
    expect(offsetMinutes(Date.UTC(2026, 6, 1), 'America/Toronto')).toBe(-240);
  });

  it('un instant tardif change de jour selon le fuseau de l’organisation', () => {
    expect(localDateOf('2026-11-21T23:30:00Z', 'Europe/Paris')).toBe('2026-11-22');
    expect(localTimeOf('2026-11-21T23:30:00Z', 'Europe/Paris')).toBe('00:30');
    expect(localDateOf('2026-11-21T23:30:00Z', 'America/Toronto')).toBe('2026-11-21');
  });

  it('l’aller-retour reste stable sur toute une année', () => {
    for (let day = 0; day < 366; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      const instant = zonedInstant(date, '10:15', 'Europe/Paris').toISOString();
      expect(localDateOf(instant, 'Europe/Paris'), date).toBe(date);
      expect(localTimeOf(instant, 'Europe/Paris'), date).toBe('10:15');
    }
  });
});
