import { z } from "zod";

export const MAX_PERIOD_DAYS = 366;

export interface Period {
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;
const utcDay = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

export const periodDays = (period: Period): number => Math.round((utcDay(period.to) - utcDay(period.from)) / DAY_MS) + 1;

const periodSchema = z
  .object({
    from: z.iso.date({ error: "Indiquez la date de début, par exemple 01/11/2026." }),
    to: z.iso.date({ error: "Indiquez la date de fin, par exemple 30/11/2026." }),
  })
  .refine((period) => period.to >= period.from, { message: "La date de fin ne peut pas précéder celle de début.", path: ["to"] })
  .refine((period) => periodDays(period) <= MAX_PERIOD_DAYS, { message: `La période ne peut pas dépasser ${String(MAX_PERIOD_DAYS)} jours.`, path: ["to"] });

export type PeriodResult = { ok: true; period: Period } | { ok: false; message: string };

export function parsePeriod(from: string, to: string): PeriodResult {
  const parsed = periodSchema.safeParse({ from, to });
  if (parsed.success) return { ok: true, period: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "La période n’est pas valide." };
}

const pad = (value: number): string => String(value).padStart(2, "0");

export function monthPeriod(now: Date = new Date()): Period {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const last = new Date(year, month, 0).getDate();
  return { from: `${String(year)}-${pad(month)}-01`, to: `${String(year)}-${pad(month)}-${pad(last)}` };
}
