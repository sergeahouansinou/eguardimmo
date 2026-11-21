import type { BatchOutcome } from './model';

export interface BatchWords {
  none: string;
  one: string;
  many: string;
}

export function batchMessage(outcome: BatchOutcome, words: BatchWords): string {
  const parts = [outcome.issued === 0 ? words.none : `${String(outcome.issued)} ${outcome.issued > 1 ? words.many : words.one}.`];
  if (outcome.failed.length > 0) parts.push(`${String(outcome.failed.length)} en échec : le service PDF peut être indisponible, relancez dans un instant.`);
  if (outcome.remaining) parts.push('D’autres éléments restent à traiter : relancez l’opération.');
  return parts.join(' ');
}
