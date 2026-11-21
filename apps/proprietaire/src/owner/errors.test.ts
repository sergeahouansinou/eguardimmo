import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import { describe, expect, it } from "vitest";
import { UnexpectedResponseError, describeFailure, isNoAccess, shouldRetry } from "./errors";

const api = (status: number, code: string, retryAfter: number | null = null) => new ApiError(status, code, "détail serveur à ne pas afficher", {}, retryAfter);

describe("describeFailure", () => {
  it.each([
    [api(401, "unauthenticated"), "unauthenticated", "Votre session a expiré"],
    [api(403, "email_unverified"), "unverified", "Confirmez votre adresse e-mail"],
    [api(403, "space_forbidden"), "noAccess", "n’a pas ou plus d’accès"],
    [api(403, "owner_access_read_only"), "readOnly", "lecture seule"],
    [api(403, "owner_role_forbidden"), "readOnly", "lecture seule"],
    [api(403, "code_inconnu"), "forbidden", "Vous n’avez pas le droit"],
    [api(404, "owner_access_not_found"), "notFound", "déjà été retiré"],
    [api(404, "owner_agency_not_found"), "notFound", "Cette agence"],
    [api(404, "code_inconnu"), "notFound", "n’existe pas ou n’est plus accessible"],
    [api(404, "owner_report_not_found"), "notFound", "n’est pas publié"],
    [api(404, "owner_invoice_not_found"), "notFound", "Cette facture"],
    [api(404, "charge_statement_not_found"), "notFound", "Ce décompte de charges"],
    [api(404, "owner_intervention_file_not_found"), "notFound", "plus partagé"],
    [api(403, "operator_token_forbidden"), "forbidden", "accès d’opérateur"],
    [api(422, "validation_failed"), "invalid", "n’est pas valide"],
    [api(503, "report_pdf_unavailable"), "unavailable", "PDF de ce compte rendu"],
    [api(503, "invoice_pdf_unavailable"), "unavailable", "PDF de cette facture"],
    [api(503, "autre"), "unavailable", "momentanément indisponible"],
    [api(429, "too_many", 30), "rateLimited", "Patientez 30 s"],
    [api(429, "too_many", 300), "rateLimited", "Patientez 5 min"],
    [api(429, "too_many"), "rateLimited", "Patientez un instant"],
    [api(500, "boom"), "other", "Une erreur est survenue"],
    [api(409, "nouveau_code_du_backend"), "other", "Une erreur est survenue"],
    [api(403, "two_factor_required"), "twoFactorRequired", "Activez la double authentification"],
    [api(403, "reauthentication_required"), "reauthenticationRequired", "moins de 10 minutes"],
    [api(409, "approval_stale"), "stale", "a changé depuis votre lecture"],
    [api(409, "approval_already_decided"), "conflict", "déjà été tranchée"],
    [api(409, "payout_account_request_pending"), "conflict", "déjà en cours"],
    [api(409, "payout_account_request_stale"), "stale", "a changé depuis votre lecture"],
    [api(409, "mandate_not_active"), "conflict", "n’est plus actif"],
    [api(404, "payout_account_request_not_found"), "notFound", "n’existe plus"],
    [api(404, "mandate_end_request_not_found"), "notFound", "Aucune demande de fin de mandat"],
    [api(422, "owner_agency_required"), "invalid", "choisissez l’agence"],
    [api(422, "statement_too_long"), "invalid", "366 jours"],
    [api(422, "payout_account_code_invalid"), "invalid", "Après 3 essais"],
    [api(422, "payout_account_iban_invalid"), "invalid", "n’est pas valide"],
    [api(422, "payout_account_unchanged"), "invalid", "déjà celui de votre compte"],
    [new ApiUnreachableError(), "unreachable", "injoignable"],
    [new UnexpectedResponseError(), "unexpected", "de façon inattendue"],
    [new Error("brut"), "other", "Une erreur est survenue"],
  ] as const)("%#", (error, kind, text) => {
    const failure = describeFailure(error);

    expect(failure.kind).toBe(kind);
    expect(failure.message).toContain(text);
    expect(failure.message).not.toContain("détail serveur");
    expect(failure.message).not.toContain("brut");
  });

  it("reconnaît l'absence d'accès propriétaire", () => {
    expect(isNoAccess(api(403, "space_forbidden"))).toBe(true);
    expect(isNoAccess(api(403, "email_unverified"))).toBe(false);
    expect(isNoAccess(new Error("x"))).toBe(false);
  });

  it("ne rejoue pas une réponse définitive et rejoue deux fois une panne", () => {
    expect(shouldRetry(0, api(401, "x"))).toBe(false);
    expect(shouldRetry(0, api(403, "x"))).toBe(false);
    expect(shouldRetry(0, api(429, "x"))).toBe(false);
    expect(shouldRetry(0, api(409, "x"))).toBe(false);
    expect(shouldRetry(0, new UnexpectedResponseError())).toBe(false);
    expect(shouldRetry(0, api(500, "x"))).toBe(true);
    expect(shouldRetry(1, new ApiUnreachableError())).toBe(true);
    expect(shouldRetry(2, api(500, "x"))).toBe(false);
  });
});
