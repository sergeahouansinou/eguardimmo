import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import type { OwnerRole } from "@/features/auth/ownerInvitationSchemas";
import { formatDuration } from "@/lib/format";

export const INVALID_INVITATION_MESSAGE =
  "Cette invitation est invalide, expirée ou déjà utilisée. Demandez à votre agence de vous en envoyer une nouvelle. Si vous l’avez déjà acceptée, connectez-vous : votre espace propriétaire vous attend.";

export const CODE_INVALID_MESSAGE =
  "Le code d’appariement est incorrect. Après plusieurs erreurs, l’invitation est bloquée : demandez-en une nouvelle à votre agence.";

export const ROLE_LABELS: Record<OwnerRole, string> = {
  holder: "propriétaire mandant",
  representative: "représentant du propriétaire mandant",
  co_owner: "co-indivisaire (lecture seule)",
};

const KNOWN_CODE_MESSAGES: Readonly<Record<string, string>> = {
  space_forbidden: "Votre compte n’a pas accès à cet espace.",
  email_unverified: "Confirmez l’adresse e-mail de votre compte avant d’accepter cette invitation.",
};

export function rateLimitedMessage(seconds: number): string {
  return `Trop de tentatives. Réessayez dans ${formatDuration(seconds)}. Votre invitation reste valable.`;
}

export function technicalProblem(error: unknown): string {
  if (error instanceof ApiUnreachableError) return error.message;
  if (error instanceof ApiError) {
    const known = KNOWN_CODE_MESSAGES[error.code];
    if (known !== undefined) return known;
  }
  return "Le serveur n’a pas pu traiter votre demande. Votre invitation reste valable : réessayez dans un instant.";
}

export function consentLines(organisation: string, role: OwnerRole): string[] {
  return [
    `Votre compte eGuardImmo (identifiant et adresse e-mail) sera rattaché à votre mandat chez ${organisation}, en tant que ${ROLE_LABELS[role]}.`,
    `${organisation} verra que ce rattachement est actif, et vous pourrez consulter en ligne les informations qu’elle partage avec vous sur vos biens confiés.`,
    "Rien d’autre n’est transmis : le rattachement ne donne accès à aucun autre dossier de l’agence.",
    "Vous pouvez mettre fin à ce rattachement à tout moment depuis votre espace ; votre mandat et ses pièces ne sont pas effacés.",
  ];
}
