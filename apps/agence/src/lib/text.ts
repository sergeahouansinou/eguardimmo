export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(query: string, ...fields: readonly string[]): boolean {
  const needle = fold(query.trim());
  return needle === "" || fields.some((field) => fold(field).includes(needle));
}

export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]?.[0], words.at(-1)?.[0]] : [words[0]?.[0], words[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase();
}
