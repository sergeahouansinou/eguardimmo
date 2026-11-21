import { ApiError, ApiUnreachableError } from "@eguardimmo/api";

export class UnexpectedResponseError extends Error {
  constructor() {
    super("Le serveur a répondu de façon inattendue. Réessayez dans un instant.");
    this.name = "UnexpectedResponseError";
  }
}

export type FailureKind =
  | "unauthenticated"
  | "unverified"
  | "noAccess"
  | "readOnly"
  | "forbidden"
  | "notFound"
  | "rateLimited"
  | "unavailable"
  | "invalid"
  | "twoFactorRequired"
  | "reauthenticationRequired"
  | "stale"
  | "conflict"
  | "unreachable"
  | "unexpected"
  | "other";

export interface Failure {
  kind: FailureKind;
  message: string;
}

const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";

function waitLabel(seconds: number | null): string {
  if (seconds === null) return "un instant";
  return seconds < 90 ? `${String(seconds)} s` : `${String(Math.ceil(seconds / 60))} min`;
}

const NOT_FOUND_MESSAGES: Readonly<Record<string, string>> = {
  owner_access_not_found: "Cet accès a déjà été retiré. La liste est mise à jour.",
  owner_agency_not_found: "Cette agence n’est plus accessible depuis votre espace.",
  owner_mandate_not_found: "Ce mandat n’existe pas ou n’est plus accessible depuis votre espace.",
  owner_unit_not_found: "Ce bien n’existe pas ou n’est plus accessible depuis votre espace.",
  owner_document_not_found: "Ce document n’existe pas ou n’est plus partagé avec vous.",
  owner_lease_not_found: "Ce bail n’existe pas ou n’est plus accessible depuis votre espace.",
  owner_report_not_found: "Ce compte rendu n’existe pas ou n’est pas publié.",
  tax_summary_not_found: "Ce relevé fiscal n’existe pas ou n’est pas publié.",
  owner_invoice_not_found: "Cette facture n’existe pas ou n’est plus accessible depuis votre espace.",
  charge_statement_not_found: "Ce décompte de charges n’existe pas ou n’est plus accessible depuis votre espace.",
  owner_intervention_not_found: "Cette intervention n’existe pas ou n’est plus accessible depuis votre espace.",
  owner_intervention_file_not_found: "Ce fichier n’est plus partagé avec vous.",
  payout_account_request_not_found: "Cette demande de changement de compte n’existe plus. La page est mise à jour.",
  mandate_end_request_not_found: "Aucune demande de fin de mandat n’est en cours sur ce mandat.",
};

function notFound(code: string): Failure {
  return { kind: "notFound", message: NOT_FOUND_MESSAGES[code] ?? "Cet élément n’existe pas ou n’est plus accessible depuis votre espace." };
}

const UNAVAILABLE_MESSAGES: Readonly<Record<string, string>> = {
  report_pdf_unavailable: "Le PDF de ce compte rendu n’est pas disponible pour le moment. Réessayez plus tard ou demandez-le à votre agence.",
  tax_pdf_unavailable: "Le PDF de ce relevé fiscal n’est pas disponible pour le moment. Réessayez plus tard ou demandez-le à votre agence.",
  invoice_pdf_unavailable: "Le PDF de cette facture n’est pas disponible pour le moment. Réessayez plus tard ou demandez-le à votre agence.",
};

function unavailable(code: string): Failure {
  return { kind: "unavailable", message: UNAVAILABLE_MESSAGES[code] ?? "Le service est momentanément indisponible. Réessayez dans un instant." };
}

function forbidden(code: string): Failure {
  if (code === "two_factor_required") {
    return { kind: "twoFactorRequired", message: "Activez la double authentification sur votre compte pour effectuer cette action." };
  }
  if (code === "reauthentication_required") {
    return { kind: "reauthenticationRequired", message: "Confirmez votre identité avec un code de double authentification de moins de 10 minutes pour continuer." };
  }
  if (code === "email_unverified") return { kind: "unverified", message: "Confirmez votre adresse e-mail pour accéder à votre espace propriétaire." };
  if (code === "operator_token_forbidden") return { kind: "forbidden", message: "Un accès d’opérateur ne peut pas ouvrir l’espace propriétaire." };
  if (code === "space_forbidden") return { kind: "noAccess", message: "Votre compte n’a pas ou plus d’accès à un espace propriétaire." };
  if (code === "owner_access_read_only") {
    return { kind: "readOnly", message: "Votre accès est en lecture seule : cette action n’est pas possible pour le moment." };
  }
  if (code === "owner_role_forbidden") {
    return { kind: "readOnly", message: "Votre rôle sur ce mandant est en lecture seule : seul le titulaire ou son représentant peut agir." };
  }
  return { kind: "forbidden", message: "Vous n’avez pas le droit d’effectuer cette action." };
}

const CONFLICT_MESSAGES: Readonly<Record<string, Failure>> = {
  approval_stale: { kind: "stale", message: "Le devis ou la demande a changé depuis votre lecture. La page est mise à jour : relisez-la avant de décider." },
  approval_already_decided: { kind: "conflict", message: "Cette demande d’accord a déjà été tranchée ou a expiré. La page est mise à jour." },
  maintenance_idempotency_key_reused: { kind: "conflict", message: "Cette décision ne correspond pas à votre tentative précédente. Rechargez la page puis recommencez." },
  payout_account_request_pending: { kind: "conflict", message: "Une demande de changement de compte de paiement est déjà en cours pour ce mandant." },
  payout_account_request_not_actionable: { kind: "conflict", message: "L’état de cette demande ne permet plus cette action. La page est mise à jour." },
  payout_account_request_stale: { kind: "stale", message: "Cette demande a changé depuis votre lecture. La page est mise à jour." },
  mandate_not_active: { kind: "conflict", message: "Ce mandat n’est plus actif : la demande de fin de mandat n’est plus possible." },
  mandate_archived: { kind: "conflict", message: "Ce mandat est archivé : aucune demande n’est possible." },
};

const INVALID_MESSAGES: Readonly<Record<string, string>> = {
  payout_account_code_invalid: "Le code est incorrect, expiré ou le nombre d’essais est épuisé. Après 3 essais, la demande est abandonnée : refaites-la.",
  payout_account_iban_invalid: "Cet IBAN n’est pas valide ou son pays n’est pas accepté.",
  payout_account_unchanged: "Cet IBAN est déjà celui de votre compte de paiement.",
  payout_account_holder_mismatch: "Le titulaire indiqué ne correspond pas à la demande.",
  email_change_code_invalid: "Ce code est incorrect ou expiré, ou cette adresse ne peut pas être utilisée. Vérifiez le code reçu ou recommencez la demande.",
  owner_agency_required: "Votre compte a plusieurs mandats : choisissez l’agence à consulter.",
  statement_too_long: "La période d’un relevé ne peut pas dépasser 366 jours. Raccourcissez-la.",
  phone_invalid: "Ce numéro de téléphone est invalide. Saisissez-le au format international, par exemple +33 6 12 34 56 78.",
};

function conflict(code: string): Failure {
  return CONFLICT_MESSAGES[code] ?? { kind: "other", message: GENERIC };
}

export function describeFailure(error: unknown): Failure {
  if (error instanceof ApiError) {
    if (error.status === 401) return { kind: "unauthenticated", message: "Votre session a expiré. Reconnectez-vous pour continuer." };
    if (error.status === 403) return forbidden(error.code);
    if (error.status === 404) return notFound(error.code);
    if (error.status === 429 && error.code === "email_change_attempts_exceeded") {
      return { kind: "rateLimited", message: "Trop de codes erronés : la demande est bloquée. Recommencez la demande de changement d’adresse pour recevoir un nouveau code." };
    }
    if (error.status === 429) {
      return { kind: "rateLimited", message: `Trop de demandes en peu de temps. Patientez ${waitLabel(error.retryAfterSeconds)} avant de réessayer.` };
    }
    if (error.status === 409) return conflict(error.code);
    if (error.status === 422) {
      return { kind: "invalid", message: INVALID_MESSAGES[error.code] ?? "Cette demande n’est pas valide. Rechargez la page puis réessayez." };
    }
    if (error.status === 503) return unavailable(error.code);
    return { kind: "other", message: GENERIC };
  }
  if (error instanceof ApiUnreachableError) return { kind: "unreachable", message: error.message };
  if (error instanceof UnexpectedResponseError) return { kind: "unexpected", message: error.message };
  return { kind: "other", message: GENERIC };
}

export function isNoAccess(error: unknown): boolean {
  return describeFailure(error).kind === "noAccess";
}

const FINAL_STATUSES: readonly number[] = [401, 403, 404, 409, 422, 429];

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && FINAL_STATUSES.includes(error.status)) return false;
  if (error instanceof UnexpectedResponseError) return false;
  return failureCount < 2;
}
