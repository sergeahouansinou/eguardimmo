import type { ZodError } from 'zod';

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && result[key] === undefined) result[key] = issue.message;
  }
  return result;
}
