import type { z } from 'zod';

export function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Saisie invalide.');
  return result.data;
}
