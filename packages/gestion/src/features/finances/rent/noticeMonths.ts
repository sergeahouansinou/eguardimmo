import { addMonths, monthLabel } from '../../locataires/kit/dates';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 3;

export const isMonth = (value: string | null | undefined): value is string => value !== null && value !== undefined && MONTH.test(value);

export function monthRange(month: string): { dueFrom: string; dueTo: string } {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { dueFrom: `${month}-01`, dueTo: `${month}-${String(last).padStart(2, '0')}` };
}

export function monthOptions(today: string, selected: string): { value: string; label: string }[] {
  const around = Array.from({ length: MONTHS_BEFORE + MONTHS_AFTER + 1 }, (_, index) => addMonths(`${today.slice(0, 7)}-01`, index - MONTHS_BEFORE).slice(0, 7));
  const months = around.includes(selected) ? around : [...around, selected].sort();
  return months.map((value) => ({ value, label: monthLabel(value) }));
}
