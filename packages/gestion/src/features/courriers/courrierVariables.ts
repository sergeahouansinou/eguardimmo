import type { Lease } from '../baux/schemas';
import { addDays, formatDateFr, todayIso } from '../locataires/kit/dates';
import { euroInput, money, parseEuros } from '../locataires/kit/money';

export interface CourrierVariables {
  amountDue: string;
  dueDate: string;
}

const AMOUNT = /^\d{1,9}([.,]\d{1,2})?$/;

export const DEFAULT_DUE_DELAY_DAYS = 7;

export function defaultVariables(lease: Lease | undefined, today: string = todayIso()): CourrierVariables {
  return { amountDue: lease ? euroInput(lease.balance < 0 ? -lease.balance : 0) : '', dueDate: addDays(today, DEFAULT_DUE_DELAY_DAYS) };
}

export function amountDueError(amountDue: string): string | undefined {
  const text = amountDue.trim();
  return text === '' || AMOUNT.test(text) ? undefined : 'Montant invalide, ex. 850 ou 850,50';
}

export function variableOverrides(variables: CourrierVariables): Record<string, string> {
  const amount = variables.amountDue.trim();
  return {
    ...(amount !== '' && AMOUNT.test(amount) ? { montant_impaye: money(parseEuros(amount)) } : {}),
    ...(variables.dueDate !== '' ? { date_limite: formatDateFr(variables.dueDate) } : {}),
  };
}
