export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function nextSequence(existing: readonly string[], prefix: string, year: number, width = 3): string {
  const pattern = new RegExp(`^${prefix}-${String(year)}-(\\d+)$`);
  const highest = existing.reduce((max, value) => {
    const found = pattern.exec(value);
    return found?.[1] ? Math.max(max, Number(found[1])) : max;
  }, 0);
  return `${prefix}-${String(year)}-${String(highest + 1).padStart(width, '0')}`;
}

export function uniqueSlug(base: string, taken: readonly string[]): string {
  const root = slugify(base) || 'element';
  if (!taken.includes(root)) return root;
  let counter = 2;
  while (taken.includes(`${root}-${String(counter)}`)) counter += 1;
  return `${root}-${String(counter)}`;
}
