import { ApiError, ApiUnreachableError } from "@eguardimmo/api";

export type OrgApiErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "two_factor_required"
  | "not_found"
  | "conflict"
  | "stale"
  | "invalid"
  | "unavailable"
  | "rate_limited"
  | "unexpected_response"
  | "no_organization";

interface OrgApiErrorOptions {
  status?: number;
  code?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  extensions?: Readonly<Record<string, unknown>>;
  cause?: unknown;
}

export class OrgApiError extends Error {
  readonly kind: OrgApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly extensions: Readonly<Record<string, unknown>>;

  constructor(kind: OrgApiErrorKind, message: string, options: OrgApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "OrgApiError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
    this.extensions = options.extensions ?? {};
  }
}

export interface ErrorCatalog {
  messages?: Readonly<Record<string, string>>;
  staleCodes?: readonly string[];
}

export const NO_ORGANIZATION_MESSAGE = "Aucune organisation n’est sélectionnée : cet écran ne peut pas être chargé.";
export const UNEXPECTED_RESPONSE_MESSAGE = "Réponse inattendue du serveur. Réessayez dans un instant.";
const ROLE_FORBIDDEN_MESSAGE = "Votre rôle ne permet pas d’accéder à cet écran ou à cette action.";
const TWO_FACTOR_MESSAGE = "Cet écran exige la double authentification. Activez-la dans Mon compte, Connexion et sécurité, puis rechargez la page.";

export const unexpectedResponse = (detail?: string): OrgApiError =>
  new OrgApiError("unexpected_response", detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: "unexpected_response" });

export const invalidInput = (message: string, field?: string): OrgApiError =>
  new OrgApiError("invalid", message, { status: 422, code: "invalid_input", fieldErrors: field === undefined ? {} : { [field]: [message] } });

export function waitLabel(seconds: number | null): string {
  if (seconds === null || seconds < 1) return "un peu plus tard";
  if (seconds <= 90) return `dans ${String(seconds)} seconde${seconds > 1 ? "s" : ""}`;
  return `dans ${String(Math.ceil(seconds / 60))} minutes`;
}

export function translateApiError(error: unknown, catalog: ErrorCatalog = {}): unknown {
  if (error instanceof ApiUnreachableError) return new OrgApiError("unavailable", error.message, { cause: error });
  if (!(error instanceof ApiError)) return error;
  const known = catalog.messages?.[error.code];
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, extensions: error.extensions, cause: error };
  if (error.status === 401) return new OrgApiError("unauthenticated", "Votre session a expiré. Reconnectez-vous.", common);
  if (error.status === 403) {
    if (error.code === "two_factor_required") return new OrgApiError("two_factor_required", TWO_FACTOR_MESSAGE, common);
    return new OrgApiError("forbidden", known ?? ROLE_FORBIDDEN_MESSAGE, common);
  }
  if (error.status === 404) return new OrgApiError("not_found", known ?? error.message, common);
  if (error.status === 409) return new OrgApiError(catalog.staleCodes?.includes(error.code) === true ? "stale" : "conflict", known ?? error.message, common);
  if (error.status === 422) return new OrgApiError("invalid", known ?? error.firstFieldError() ?? error.message, common);
  if (error.status === 429) return new OrgApiError("rate_limited", `Trop de requêtes en peu de temps. Aucune modification n’a été enregistrée : réessayez ${waitLabel(error.retryAfterSeconds)}.`, common);
  if (error.status === 503) return new OrgApiError("unavailable", known ?? "Le service est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.", common);
  return new OrgApiError("unexpected_response", error.message, common);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez.";
}
