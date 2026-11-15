import type { SortDirection } from '../../outils/kit';

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return { key: null, direction: 'asc' };
}

export function sortItems<T, K extends string>(
  items: readonly T[],
  state: SortState<K>,
  compare: (key: K, a: T, b: T) => number,
): T[] {
  const { key } = state;
  if (key === null) return [...items];
  const sign = state.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * compare(key, a, b));
}
