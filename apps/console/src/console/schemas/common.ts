import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();
export const count = z.number().int().nonnegative();
export const minorSchema = z.number().int().nonnegative();
export const toneSchema = z.enum(['neutral', 'info', 'success', 'warning', 'danger']);
export type Tone = z.infer<typeof toneSchema>;

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(8),
});
export type ListQuery = z.input<typeof listQuerySchema>;

export function pageOf<T extends z.ZodType>(row: T) {
  return z.object({
    rows: z.array(row),
    total: count,
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), lastPage);
  return {
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    total: items.length,
    page: current,
    pageSize,
  };
}

export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesQuery(query: string, ...fields: string[]): boolean {
  const needle = fold(query.trim());
  if (needle === '') return true;
  return fields.some((field) => fold(field).includes(needle));
}

export class ConsoleError extends Error {
  readonly code: 'not_found' | 'conflict' | 'invalid' | 'forbidden';

  constructor(code: ConsoleError['code'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConsoleError';
    this.code = code;
  }
}
