import { slugify } from '../../outils/kit';

export function uniqueSlug(label: string, existing: readonly string[], fallback: string): string {
  const base = slugify(label) || fallback;
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base}-${String(suffix)}`)) suffix += 1;
  return `${base}-${String(suffix)}`;
}
