import { ApiError } from "@eguardimmo/api";
import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";

export const UNAVAILABLE_MESSAGE = "Cette fonction arrive bientôt.";
export const DEFAULT_RETRY_SECONDS = 60;

export interface ApiAuthDependencies {
  now?: () => Date;
}

export interface AuthContext {
  client: ApiClient;
  now: () => Date;
  knowledge: { twoFactor: boolean | null; passwordConfirmedAt: number | null };
}

export function unavailable(): () => Promise<never> {
  return () => Promise.reject(new Error(UNAVAILABLE_MESSAGE));
}

export function parseResponse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("Réponse inattendue du serveur. Réessayez dans un instant.");
  return parsed.data;
}

export function toUtc(iso: string): string;
export function toUtc(iso: string | null): string | null;
export function toUtc(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("Réponse inattendue du serveur. Réessayez dans un instant.");
  return date.toISOString();
}

export function retryAfter(error: ApiError): number {
  return error.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS;
}

export function hasFieldError(error: ApiError, field: string): boolean {
  return (error.fieldErrors[field]?.length ?? 0) > 0;
}

export function handled<R>(error: unknown, map: (error: ApiError) => R | null): R {
  if (error instanceof ApiError) {
    const result = map(error);
    if (result !== null) return result;
  }
  throw error;
}
