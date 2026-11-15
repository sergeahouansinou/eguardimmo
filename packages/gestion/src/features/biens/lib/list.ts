export type SortDirection = 'asc' | 'desc';

export interface Sort<K extends string> {
  key: K;
  direction: SortDirection;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}

export function sortItems<T>(items: readonly T[], value: (item: T) => string | number | null, direction: SortDirection): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' }) * factor;
  });
}

export function toggleIn<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}
