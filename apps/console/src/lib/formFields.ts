import { z } from 'zod';

export const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} : nombre entier attendu.`)
    .transform(Number)
    .refine((value) => value >= min && value <= max, `${label} : entre ${String(min)} et ${String(max)}.`);

export const optionalWholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === '') return null;
      const parsed = wholeNumber(label, min, max).safeParse(value);
      if (parsed.success) return parsed.data;
      for (const issue of parsed.error.issues) context.addIssue({ code: 'custom', message: issue.message });
      return z.NEVER;
    });
