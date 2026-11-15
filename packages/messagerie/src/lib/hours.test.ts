import { describe, expect, it } from 'vitest';
import { isSupportOnline } from './hours';

describe('isSupportOnline', () => {
  it('est en ligne en semaine entre 9 h et 18 h, heure de Paris', () => {
    expect(isSupportOnline(new Date('2026-11-13T09:00:00+01:00'))).toBe(true);
    expect(isSupportOnline(new Date('2026-11-13T17:59:00+01:00'))).toBe(true);
  });

  it('est hors ligne avant l’ouverture, à la fermeture et la nuit', () => {
    expect(isSupportOnline(new Date('2026-11-13T08:59:00+01:00'))).toBe(false);
    expect(isSupportOnline(new Date('2026-11-13T18:00:00+01:00'))).toBe(false);
    expect(isSupportOnline(new Date('2026-11-13T23:30:00+01:00'))).toBe(false);
  });

  it('est hors ligne le week-end', () => {
    expect(isSupportOnline(new Date('2026-11-14T10:00:00+01:00'))).toBe(false);
    expect(isSupportOnline(new Date('2026-11-15T10:00:00+01:00'))).toBe(false);
  });

  it('tient compte du fuseau et non de l’heure UTC', () => {
    expect(isSupportOnline(new Date('2026-07-14T07:30:00Z'))).toBe(true);
    expect(isSupportOnline(new Date('2026-07-14T06:30:00Z'))).toBe(false);
  });
});
