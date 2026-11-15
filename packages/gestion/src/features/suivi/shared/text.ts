export const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const matchesQuery = (query: string, ...fields: readonly (string | null | undefined)[]): boolean => {
  const needle = fold(query.trim());
  if (needle === '') return true;
  return fields.some((field) => field !== null && field !== undefined && fold(field).includes(needle));
};

export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${String(count)} ${count > 1 ? pluralForm : singular}`;

export const compareText = (a: string, b: string): number => a.localeCompare(b, 'fr', { sensitivity: 'base' });
