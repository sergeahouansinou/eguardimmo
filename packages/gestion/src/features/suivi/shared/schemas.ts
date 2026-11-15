import { z } from 'zod';
import { isValidIsoDate } from './dates';

export const isoDateSchema = z.string().refine(isValidIsoDate, 'Indiquez une date valide.');

export const fileMetaSchema = z.object({
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
});
export type FileMeta = z.infer<typeof fileMetaSchema>;

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    errors[key] ??= issue.message;
  }
  return errors;
}

export const NONE = 'aucun';
