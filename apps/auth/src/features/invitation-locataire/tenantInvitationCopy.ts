import { ApiError, ApiUnreachableError } from "@eguardimmo/api";
import { formatDuration } from "@/lib/format";

export const INVALID_INVITATION_MESSAGE =
  "Cette invitation est invalide, expirée ou déjà utilisée. Demandez à votre gestionnaire de vous en envoyer une nouvelle. Si vous l’avez déjà acceptée, connectez-vous : votre espace locataire vous attend.";

export function rateLimitedMessage(seconds: number): string {
  return `Trop de tentatives. Réessayez dans ${formatDuration(seconds)}. Votre invitation reste valable.`;
}

export function technicalProblem(error: unknown): string {
  if (error instanceof ApiUnreachableError) return error.message;
  if (error instanceof ApiError && error.status === 403) return error.message;
  return "Le serveur n’a pas pu traiter votre demande. Votre invitation reste valable : réessayez dans un instant.";
}

export function consentLines(organisation: string): string[] {
  return [
    `Votre compte eGuardImmo (identifiant et adresse e-mail) sera rattaché à votre fiche de locataire chez ${organisation}.`,
    `${organisation} verra que ce rattachement est actif, et vous pourrez consulter en ligne vos baux et les informations que cette organisation partage avec vous.`,
    "Rien d’autre n’est transmis : le rattachement ne donne accès à aucun autre dossier de l’organisation.",
    "Vous pouvez mettre fin à ce rattachement à tout moment ; vos baux et leurs pièces ne sont pas effacés.",
  ];
}
