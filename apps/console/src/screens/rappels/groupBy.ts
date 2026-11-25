export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups, ([key, grouped]) => ({ key, items: grouped }));
}
