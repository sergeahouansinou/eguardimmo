import { parseCsv } from '../csv';
import { isIsoDate, parseFrenchDate } from '../dates';
import { parseMoneyInput } from '../money';
import type { Pret } from '../schemas';

export type ScheduleLine = NonNullable<Pret['echeancier']>[number];

export interface ParsedSchedule {
  lignes: ScheduleLine[];
  errors: string[];
}

const toDate = (text: string): string | null => (isIsoDate(text) ? text : parseFrenchDate(text));

export function parseSchedule(text: string): ParsedSchedule {
  const lignes: ScheduleLine[] = [];
  const errors: string[] = [];
  parseCsv(text).forEach((cells, index) => {
    const date = toDate(cells[0] ?? '');
    if (date === null && index === 0) return;
    const amounts = cells.slice(1, 5).map((cell) => parseMoneyInput(cell));
    const [mensualite, interets, capital, restant] = amounts;
    if (date === null || cells.length < 5 || mensualite == null || interets == null || capital == null || restant == null) {
      errors.push(`Ligne ${String(index + 1)} : attendu « date ; mensualité ; intérêts ; capital ; restant dû ».`);
      return;
    }
    lignes.push({ date, mensualite, interets, capital, restant });
  });
  if (lignes.length === 0 && errors.length === 0) errors.push('Aucune ligne reconnue.');
  return { lignes, errors };
}

export function parseRate(text: string): number | null {
  const match = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export const formatRate = (tauxBp: number): string => `${String(Math.trunc(tauxBp / 100))},${String(tauxBp % 100).padStart(2, '0')}`;
