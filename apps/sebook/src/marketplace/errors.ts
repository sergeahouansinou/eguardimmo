import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import { ZodError } from "zod";

export class UnexpectedResponseError extends Error {
  constructor() {
    super("Le serveur a répondu de façon inattendue. Réessayez dans un instant.");
    this.name = "UnexpectedResponseError";
  }
}

export type FailureKind = "unauthenticated" | "unverified" | "datesUnavailable" | "invalid" | "notFound" | "rateLimited" | "unreachable" | "unexpected" | "other";

export interface Failure {
  kind: FailureKind;
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}

const NO_FIELDS = {} as const;

export function describeFailure(error: unknown): Failure {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { kind: "unauthenticated", message: "Votre session a expiré. Reconnectez-vous pour continuer.", fieldErrors: NO_FIELDS };
    }
    if (error.status === 403 && error.code === "email_unverified") {
      return { kind: "unverified", message: "Confirmez votre adresse e-mail pour continuer.", fieldErrors: NO_FIELDS };
    }
    if (error.status === 403) return { kind: "other", message: "Vous n’avez pas le droit d’effectuer cette action.", fieldErrors: NO_FIELDS };
    if (error.status === 404) return { kind: "notFound", message: "Cet élément n’existe pas ou n’est plus disponible.", fieldErrors: NO_FIELDS };
    if (error.status === 409 && error.code === "dates_unavailable") {
      return { kind: "datesUnavailable", message: "Ces dates ne sont plus disponibles. Choisissez d’autres dates.", fieldErrors: NO_FIELDS };
    }
    if (error.status === 422) return { kind: "invalid", message: error.firstFieldError() ?? error.message, fieldErrors: error.fieldErrors };
    if (error.status === 429) {
      const wait = error.retryAfterSeconds === null ? "un instant" : `${String(error.retryAfterSeconds)} s`;
      return { kind: "rateLimited", message: `Trop de demandes en peu de temps. Patientez ${wait} avant de réessayer.`, fieldErrors: NO_FIELDS };
    }
    if (error.status >= 500) return { kind: "other", message: "Le service est momentanément indisponible. Réessayez dans un instant.", fieldErrors: NO_FIELDS };
    return { kind: "other", message: error.message, fieldErrors: NO_FIELDS };
  }
  if (error instanceof ApiUnreachableError) return { kind: "unreachable", message: error.message, fieldErrors: NO_FIELDS };
  if (error instanceof UnexpectedResponseError || error instanceof ZodError) {
    return { kind: "unexpected", message: new UnexpectedResponseError().message, fieldErrors: NO_FIELDS };
  }
  return { kind: "other", message: "Une erreur est survenue. Réessayez.", fieldErrors: NO_FIELDS };
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof ApiUnreachableError;
}
