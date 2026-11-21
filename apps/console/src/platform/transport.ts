import type { ApiClient, Query } from '@eguardimmo/api';
import { z } from 'zod';
import { UnexpectedResponseError } from './errors';

export const CONSOLE_ROOT = '/api/v1/console';

export function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedResponseError();
  return parsed.data;
}

export const segment = (value: string): string => encodeURIComponent(value);

export const flag = (value: boolean | undefined): number | undefined => (value === undefined ? undefined : value ? 1 : 0);

export function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export const dateTime = z.iso.datetime({ offset: true });
export const nullableDateTime = dateTime.nullable();
export const uuid = z.string().min(1);
export const count = z.number().int().nonnegative();

export const emptyObjectOrList = z.union([z.record(z.string(), z.unknown()), z.array(z.never()).length(0)]);

export function dataOf<S extends z.ZodType>(item: S) {
  return z.object({ data: item });
}

export function listOf<S extends z.ZodType, M extends z.ZodRawShape>(item: S, meta: M) {
  return z.object({
    data: z.array(item),
    meta: z.object({ has_more: z.boolean(), next_cursor: z.string().nullable(), ...meta }),
  });
}

export interface CursorPage<T> {
  rows: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface CursorQuery {
  cursor?: string;
  perPage?: number;
}

export const cursorParams = (query: CursorQuery): Query => ({ cursor: filled(query.cursor), per_page: query.perPage });

export async function read<S extends z.ZodType>(client: ApiClient, path: string, schema: S, query?: Query): Promise<z.infer<S>> {
  return parse(schema, await client.get(`${CONSOLE_ROOT}${path}`, query));
}

export async function write<S extends z.ZodType>(client: ApiClient, path: string, schema: S, body?: Record<string, unknown>): Promise<z.infer<S>> {
  return parse(schema, await client.post(`${CONSOLE_ROOT}${path}`, body));
}
