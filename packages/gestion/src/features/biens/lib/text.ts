export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matches(needle: string, ...haystack: (string | null | undefined)[]): boolean {
  const query = fold(needle.trim());
  if (!query) return true;
  return haystack.some((value) => value != null && fold(value).includes(query));
}

export function slugify(text: string): string {
  return fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const root = slugify(base) || 'element';
  if (!taken.has(root)) return root;
  let index = 2;
  while (taken.has(`${root}-${String(index)}`)) index += 1;
  return `${root}-${String(index)}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count > 1 ? pluralForm : singular}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

const UNITS = ['o', 'Ko', 'Mo', 'Go'] as const;

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const text = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
  return `${text} ${UNITS[unit] ?? 'o'}`;
}
