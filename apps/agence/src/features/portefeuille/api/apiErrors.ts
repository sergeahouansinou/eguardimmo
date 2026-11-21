import { ApiError } from "@eguardimmo/api";

export type MandatesApiErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "agency_only"
  | "not_found"
  | "stale_version"
  | "overlap"
  | "not_clean"
  | "conflict"
  | "invalid"
  | "unexpected_response"
  | "no_organization"
  | "unsupported";

interface ErrorOptions {
  status?: number;
  code?: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  cause?: unknown;
}

export class MandatesApiError extends Error {
  readonly kind: MandatesApiErrorKind;
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;

  constructor(kind: MandatesApiErrorKind, message: string, options: ErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "MandatesApiError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? kind;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export const NO_ORGANIZATION_MESSAGE = "Aucune organisation n’est sélectionnée : les mandats ne peuvent pas être chargés.";
export const UNEXPECTED_RESPONSE_MESSAGE = "Réponse inattendue du serveur. Réessayez dans un instant.";
export const STALE_VERSION_MESSAGE = "Ce mandat a été modifié par quelqu’un d’autre. Rechargez-le pour voir sa dernière version, puis refaites votre changement.";
export const FORBIDDEN_MESSAGE = "Votre rôle ne permet pas de modifier les mandats. Demandez à un administrateur ou à un gestionnaire de l’agence.";
export const OVERLAP_MESSAGE = "Un autre mandat de votre agence couvre déjà un de ces lots sur cette période. Retirez le lot, changez les dates, ou mettez d’abord fin à l’autre mandat.";

export const NOT_CLEAN_MESSAGE = "Ce fichier n’a pas fini son analyse antivirus, ou n’est pas sain. Patientez un instant puis réessayez ; s’il reste refusé, déposez un autre fichier.";

export const AMENDMENT_LOCKED_MESSAGE = "Un avenant signé reste partagé avec le mandant : il ne peut pas être retiré.";
export const AMENDMENT_LOCKED_CODE = "mandate_amendment_document_locked";
export const NOT_CLEAN_CODE = "document_not_clean";
export const STALE_VERSION_CODE = "mandate_stale_version";
export const OVERLAP_CODE = "mandate_overlap";
export const AGENCY_ONLY_CODE = "mandate_agency_only";

export const END_REQUEST_NOT_FOUND_CODE = "mandate_end_request_not_found";
export const END_REQUEST_NOT_PENDING_CODE = "mandate_end_request_not_pending";
export const MANDATE_NOT_FOUND_CODE = "mandate_not_found";
export const END_REQUEST_NOT_FOUND_MESSAGE = "Il n’y a plus de demande de fin de mandat à classer : elle a peut-être déjà été traitée ou retirée par le propriétaire.";
export const END_REQUEST_NOT_PENDING_MESSAGE = "Cette demande de fin de mandat a déjà été traitée ou retirée : elle ne peut plus être classée sans suite.";
export const MANDATE_NOT_FOUND_MESSAGE = "Ce mandat n’existe plus ou n’est plus accessible.";

export const unexpectedResponse = (detail?: string): MandatesApiError =>
  new MandatesApiError("unexpected_response", detail ? `${UNEXPECTED_RESPONSE_MESSAGE} (${detail})` : UNEXPECTED_RESPONSE_MESSAGE, { code: "unexpected_response" });

export const unsupported = (message: string): MandatesApiError => new MandatesApiError("unsupported", message, { code: "unsupported" });

export const invalid = (message: string, field?: string): MandatesApiError =>
  new MandatesApiError("invalid", message, { status: 422, code: "invalid_input", fieldErrors: field === undefined ? {} : { [field]: [message] } });

export function translateApiError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const common = { status: error.status, code: error.code, fieldErrors: error.fieldErrors, cause: error };
  if (error.status === 401) return new MandatesApiError("unauthenticated", "Votre session a expiré. Reconnectez-vous.", common);
  if (error.status === 403) {
    return error.code === AGENCY_ONLY_CODE ? new MandatesApiError("agency_only", error.message, common) : new MandatesApiError("forbidden", FORBIDDEN_MESSAGE, common);
  }
  if (error.status === 404) {
    if (error.code === END_REQUEST_NOT_FOUND_CODE) return new MandatesApiError("not_found", END_REQUEST_NOT_FOUND_MESSAGE, common);
    if (error.code === MANDATE_NOT_FOUND_CODE) return new MandatesApiError("not_found", MANDATE_NOT_FOUND_MESSAGE, common);
    return new MandatesApiError("not_found", error.message, common);
  }
  if (error.status === 409) {
    if (error.code === STALE_VERSION_CODE) return new MandatesApiError("stale_version", STALE_VERSION_MESSAGE, common);
    if (error.code === NOT_CLEAN_CODE) return new MandatesApiError("not_clean", NOT_CLEAN_MESSAGE, common);
    if (error.code === AMENDMENT_LOCKED_CODE) return new MandatesApiError("conflict", AMENDMENT_LOCKED_MESSAGE, common);
    if (error.code === OVERLAP_CODE) return new MandatesApiError("overlap", OVERLAP_MESSAGE, common);
    if (error.code === END_REQUEST_NOT_PENDING_CODE) return new MandatesApiError("conflict", END_REQUEST_NOT_PENDING_MESSAGE, common);
    return new MandatesApiError("conflict", error.message, common);
  }
  if (error.status === 422) return new MandatesApiError("invalid", error.firstFieldError() ?? error.message, common);
  return error;
}
