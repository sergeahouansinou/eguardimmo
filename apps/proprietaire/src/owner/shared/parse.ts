import type { z } from "zod";
import { UnexpectedResponseError } from "../errors";

export function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedResponseError();
  return parsed.data;
}

export const segment = (id: string): string => encodeURIComponent(id);

export function listQuery(agency: string | null, cursor: string | null): Record<string, string> {
  const query: Record<string, string> = {};
  if (agency !== null) query.agency = agency;
  if (cursor !== null) query.cursor = cursor;
  return query;
}
