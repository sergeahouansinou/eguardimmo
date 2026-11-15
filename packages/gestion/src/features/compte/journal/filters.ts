import { isoDay } from '../shared/dates';
import type { EventType, JournalEvent } from './schemas';

export interface JournalFilters {
  search: string;
  from: string;
  to: string;
  member: string;
  type: EventType | 'all';
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterEvents(events: readonly JournalEvent[], filters: JournalFilters): JournalEvent[] {
  const needle = fold(filters.search.trim());
  return events
    .filter((item) => {
      const day = isoDay(item.at);
      if (day < filters.from || day > filters.to) return false;
      if (filters.member !== 'all' && item.memberId !== filters.member) return false;
      if (filters.type !== 'all' && item.type !== filters.type) return false;
      return needle === '' || fold(`${item.action} ${item.detail} ${item.member}`).includes(needle);
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous > 1) result.push(null);
    result.push(n);
  });
  return result;
}
