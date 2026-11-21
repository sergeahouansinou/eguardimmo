import { ApiError, ApiUnreachableError } from '@eguardimmo/api';

export class UnexpectedResponseError extends Error {
  constructor() {
    super('Le serveur a répondu de façon inattendue. Réessayez dans un instant.');
    this.name = 'UnexpectedResponseError';
  }
}

export type ThreadFailureKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'readOnly'
  | 'notFound'
  | 'closed'
  | 'rateLimited'
  | 'invalid'
  | 'conflict'
  | 'unavailable'
  | 'unreachable'
  | 'unexpected'
  | 'other';

export interface ThreadFailure {
  kind: ThreadFailureKind;
  message: string;
}

const GENERIC = 'Une erreur est survenue. Réessayez dans un instant.';
const GENERIC_FORBIDDEN = 'Vous n’avez pas le droit d’effectuer cette action.';
const ATTACHMENT_RULES = 'Une pièce jointe est refusée : PDF ou image (JPEG, PNG, WebP), 10 Mo au plus, 5 pièces au maximum.';

const FORBIDDEN: Readonly<Record<string, ThreadFailure>> = {
  conversation_muted: { kind: 'readOnly', message: 'L’agence a restreint l’envoi de messages sur cette conversation : vous pouvez encore la lire.' },
  conversation_read_only: { kind: 'readOnly', message: 'Votre mandat est terminé : vous pouvez relire cette conversation, sans y répondre.' },
  owner_role_forbidden: { kind: 'readOnly', message: 'Votre rôle sur ce mandat est en lecture seule : seul le titulaire ou son représentant peut écrire à l’agence.' },
  conversation_kind_unavailable: { kind: 'forbidden', message: 'Les messages avec cette agence ne sont pas disponibles pour votre compte.' },
  message_redaction_forbidden: { kind: 'forbidden', message: 'Vous ne pouvez retirer que vos propres messages.' },
  two_factor_required: { kind: 'forbidden', message: 'Activez la double authentification sur votre compte pour effectuer cette action.' },
  reauthentication_required: { kind: 'forbidden', message: 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes pour continuer.' },
  email_unverified: { kind: 'forbidden', message: 'Confirmez votre adresse e-mail pour accéder à vos messages.' },
  space_forbidden: { kind: 'forbidden', message: 'Votre compte n’a pas ou plus d’accès à cet espace.' },
};

const NOT_FOUND: Readonly<Record<string, string>> = {
  conversation_not_found: 'Cette conversation n’existe pas ou n’est plus accessible depuis votre espace.',
  conversation_link_not_found: 'Ce bail ou ce mandat n’est plus disponible pour écrire à votre agence. Rechargez la page.',
  message_not_found: 'Ce message n’existe plus dans cette conversation.',
  attachment_not_found: 'Cette pièce jointe n’existe plus ou ne vous est plus accessible.',
  owner_agency_not_found: 'Cette agence n’est plus accessible depuis votre espace.',
};

const CONFLICT: Readonly<Record<string, ThreadFailure>> = {
  conversation_closed: { kind: 'closed', message: 'L’agence a fermé cette conversation : vous ne pouvez plus y répondre. Une nouvelle réponse de l’agence la rouvrira.' },
  conversation_open_limit: { kind: 'conflict', message: 'Vous avez déjà beaucoup de conversations ouvertes avec cette agence. Attendez qu’elles soient closes avant d’en ouvrir une nouvelle.' },
  conversation_storage_full: { kind: 'conflict', message: 'Cette conversation ne peut plus recevoir de pièces jointes.' },
  message_redaction_expired: { kind: 'conflict', message: 'Un message ne se retire que dans les 15 minutes qui suivent son envoi.' },
  idempotency_key_reused: { kind: 'conflict', message: 'Ce message a déjà été enregistré avec un contenu différent. Modifiez-le pour l’envoyer de nouveau.' },
};

function waitLabel(seconds: number | null): string {
  if (seconds === null) return 'un instant';
  return seconds < 90 ? `${String(seconds)} s` : `${String(Math.ceil(seconds / 60))} min`;
}

function invalid(error: ApiError): ThreadFailure {
  const fields = Object.keys(error.fieldErrors);
  if (error.code === 'recipient_not_found') return { kind: 'invalid', message: 'Ce destinataire ne fait pas partie de vos contacts.' };
  if (fields.some((field) => field === 'body')) return { kind: 'invalid', message: 'Le message est vide ou dépasse 5 000 caractères.' };
  if (fields.some((field) => field === 'subject')) return { kind: 'invalid', message: 'L’objet est obligatoire (140 caractères au plus).' };
  if (fields.some((field) => field.startsWith('attachments'))) return { kind: 'invalid', message: ATTACHMENT_RULES };
  return { kind: 'invalid', message: 'Certains champs sont invalides : vérifiez votre saisie.' };
}

export function describeThreadFailure(error: unknown): ThreadFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) return { kind: 'unauthenticated', message: 'Votre session a expiré. Reconnectez-vous pour continuer.' };
    if (error.status === 403) return FORBIDDEN[error.code] ?? { kind: 'forbidden', message: GENERIC_FORBIDDEN };
    if (error.status === 404) return { kind: 'notFound', message: NOT_FOUND[error.code] ?? 'Cet élément n’existe pas ou n’est plus accessible depuis votre espace.' };
    if (error.status === 409) return CONFLICT[error.code] ?? { kind: 'conflict', message: GENERIC };
    if (error.status === 422) return invalid(error);
    if (error.status === 429 && error.code === 'conversation_attachment_limit') {
      return { kind: 'rateLimited', message: 'Le nombre de pièces jointes envoyées aujourd’hui est atteint : réessayez demain.' };
    }
    if (error.status === 429) {
      return { kind: 'rateLimited', message: `Trop de demandes en peu de temps. Patientez ${waitLabel(error.retryAfterSeconds)} avant de réessayer.` };
    }
    if (error.status === 503) return { kind: 'unavailable', message: 'Le service est momentanément indisponible. Réessayez dans un instant.' };
    return { kind: 'other', message: GENERIC };
  }
  if (error instanceof ApiUnreachableError) return { kind: 'unreachable', message: error.message };
  if (error instanceof UnexpectedResponseError) return { kind: 'unexpected', message: error.message };
  return { kind: 'other', message: GENERIC };
}

export function threadErrorMessage(error: unknown): string {
  return describeThreadFailure(error).message;
}

const FINAL_STATUSES: readonly number[] = [401, 403, 404];

export function isFinalFailure(error: unknown): boolean {
  return error instanceof ApiError && FINAL_STATUSES.includes(error.status);
}

const RESEND_SAFE: readonly ThreadFailureKind[] = ['unreachable', 'unavailable', 'other', 'unexpected'];

export function sendFailureMessage(error: unknown): string {
  const failure = describeThreadFailure(error);
  return RESEND_SAFE.includes(failure.kind) ? `${failure.message} Si vous renvoyez le message, il ne sera enregistré qu’une seule fois.` : failure.message;
}
