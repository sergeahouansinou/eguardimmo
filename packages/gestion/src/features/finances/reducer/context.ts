import { formatMoney } from '../../../format/money';
import type { FinancesData } from '../schemas';

export class FinancesCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancesCommandError';
  }
}

export function fail(message: string): never {
  throw new FinancesCommandError(message);
}

export interface ReducerContext {
  now: string;
  id: (prefix: string) => string;
}

export interface Outcome {
  message: string;
  href?: string;
  id?: string;
}

export const money = (data: FinancesData, minor: number): string => formatMoney(minor, data.currency);

export function find<T extends { id: string }>(items: readonly T[], id: string, label: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) return fail(`${label} introuvable.`);
  return item;
}

export function notInFuture(data: FinancesData, date: string, label: string): void {
  if (date > data.today) fail(`${label} ne peut pas être dans le futur.`);
}
