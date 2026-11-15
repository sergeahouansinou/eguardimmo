import type { CampaignPeriod } from '../data/schemas';

const PARIS = 'Europe/Paris';

function yearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: '2-digit', timeZone: PARIS }).formatToParts(date);
  const read = (type: 'year' | 'month') => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month') };
}

export function matchesPeriod(iso: string | null, period: CampaignPeriod, now: Date): boolean {
  if (period === 'all' || iso === null) return true;
  const target = yearMonth(new Date(iso));
  const current = yearMonth(now);
  if (period === 'year') return target.year === current.year;
  const gap = (current.year - target.year) * 12 + (current.month - target.month);
  return period === 'month' ? gap === 0 : gap >= 0 && gap <= 2;
}
