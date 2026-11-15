import { z } from 'zod';

export const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} : nombre entier attendu.`)
    .transform(Number)
    .refine((value) => value >= min && value <= max, `${label} : entre ${String(min)} et ${String(max)}.`);
