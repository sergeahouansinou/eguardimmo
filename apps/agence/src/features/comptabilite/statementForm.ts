import { z } from "zod";
import { addMonths, yearMonth } from "@/lib/dates";
import type { LeaseOption, StatementInput } from "./schemas";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Saisissez une date valide.");

export const statementFormSchema = z
  .object({
    lease: z.string().min(1, "Choisissez un bail."),
    currency: z.string().regex(/^[A-Z]{3}$/, "Choisissez une devise."),
    from: isoDay,
    to: isoDay,
  })
  .refine((values) => values.to >= values.from, { path: ["to"], message: "La date de fin précède la date de début." });

export type StatementFormValues = z.input<typeof statementFormSchema>;
export type StatementFormErrors = Partial<Record<keyof StatementFormValues, string>>;

export function validateStatement(values: StatementFormValues): { input: StatementInput } | { errors: StatementFormErrors } {
  const parsed = statementFormSchema.safeParse(values);
  if (parsed.success) return { input: parsed.data };
  const errors: StatementFormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "lease" || field === "currency" || field === "from" || field === "to") errors[field] ??= issue.message;
  }
  return { errors };
}

export function defaultPeriod(today: string): { from: string; to: string } {
  return { from: `${yearMonth(addMonths(today, -2))}-01`, to: today };
}

export function currencyChoices(lease: LeaseOption | undefined): string[] {
  const base = ["EUR", "XOF"];
  return lease === undefined || base.includes(lease.currency) ? base : [...base, lease.currency];
}
