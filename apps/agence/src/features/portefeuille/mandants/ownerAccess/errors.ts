import { ApiError, ApiUnreachableError } from "@eguardimmo/api";

export type OwnerAccessFailureKind =
  | "unauthenticated"
  | "twoFactorRequired"
  | "reauthenticationRequired"
  | "forbidden"
  | "invalid"
  | "conflict"
  | "notFound"
  | "rateLimited"
  | "unreachable"
  | "unexpected"
  | "other";

export type OwnerAccessField = "role" | "email" | "personPartyId" | "identityVerified" | "powersVerified";

export interface OwnerAccessFailure {
  kind: OwnerAccessFailureKind;
  message: string;
  field?: OwnerAccessField;
}

export class UnexpectedOwnerAccessResponseError extends Error {
  constructor() {
    super("Le serveur a répondu de façon inattendue. Réessayez dans un instant.");
    this.name = "UnexpectedOwnerAccessResponseError";
  }
}

const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";

const BY_CODE: Readonly<Record<string, OwnerAccessFailure>> = {
  two_factor_required: {
    kind: "twoFactorRequired",
    message: "Activez la double authentification sur votre compte pour inviter un propriétaire.",
  },
  reauthentication_required: {
    kind: "reauthenticationRequired",
    message: "Confirmez votre identité avec un code de double authentification (moins de 10 minutes) avant d’inviter un propriétaire.",
  },
  role_forbidden: { kind: "forbidden", message: "Votre rôle ne permet pas de gérer l’accès propriétaire. Demandez à un administrateur ou à un gestionnaire de l’agence." },
  owner_identity_attestation_required: {
    kind: "invalid",
    message: "Cochez les attestations : l’agence déclare avoir vérifié l’identité du mandant (et les pouvoirs d’un représentant).",
    field: "identityVerified",
  },
  owner_access_role_invalid: {
    kind: "invalid",
    message: "Ce rôle ne correspond pas à ce mandant : titulaire pour une personne, représentant pour une société, co-indivisaire avec la fiche de la personne.",
    field: "role",
  },
  owner_access_email_required: {
    kind: "invalid",
    message: "Indiquez l’adresse e-mail à inviter : la fiche n’a pas d’e-mail principal.",
    field: "email",
  },
  owner_access_email_forbidden: {
    kind: "invalid",
    message: "Cette adresse est celle de l’invitant ou d’un membre de l’agence : un propriétaire se rattache avec sa propre adresse.",
    field: "email",
  },
  owner_access_limit_reached: {
    kind: "conflict",
    message: "Ce mandant a atteint le nombre maximal de comptes rattachés : retirez un accès ou une invitation avant d’en envoyer une autre.",
  },
  owner_access_already_linked: { kind: "conflict", message: "Ce compte est déjà rattaché à ce mandant." },
  owner_access_party_archived: { kind: "conflict", message: "Ce contact est archivé : restaurez-le avant de l’inviter." },
  owner_access_not_found: { kind: "notFound", message: "Cet accès ou cette invitation n’existe plus. La liste est mise à jour." },
  party_not_found: { kind: "notFound", message: "Cette fiche n’existe pas ou n’est plus accessible." },
  party_anonymized: { kind: "conflict", message: "Ce contact a été anonymisé : il ne peut plus être invité." },
  invitation_daily_limit_reached: {
    kind: "rateLimited",
    message: "Le nombre maximal d’invitations par jour est atteint pour votre agence. Réessayez demain.",
  },
};

function waitLabel(seconds: number | null): string {
  if (seconds === null) return "un instant";
  return seconds < 90 ? `${String(seconds)} s` : `${String(Math.ceil(seconds / 60))} min`;
}

export function describeOwnerAccessFailure(error: unknown): OwnerAccessFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) return { kind: "unauthenticated", message: "Votre session a expiré. Reconnectez-vous pour continuer." };
    const known = BY_CODE[error.code];
    if (known) return known;
    if (error.status === 403) return { kind: "forbidden", message: "Vous n’avez pas le droit d’effectuer cette action." };
    if (error.status === 404) return { kind: "notFound", message: "Cet élément n’existe pas ou n’est plus accessible." };
    if (error.status === 429) {
      return { kind: "rateLimited", message: `Trop de demandes en peu de temps. Patientez ${waitLabel(error.retryAfterSeconds)} avant de réessayer.` };
    }
    return { kind: "other", message: GENERIC };
  }
  if (error instanceof ApiUnreachableError) return { kind: "unreachable", message: error.message };
  if (error instanceof UnexpectedOwnerAccessResponseError) return { kind: "unexpected", message: error.message };
  return { kind: "other", message: GENERIC };
}
