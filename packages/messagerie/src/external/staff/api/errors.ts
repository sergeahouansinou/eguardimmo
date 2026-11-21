import { ApiError } from '@eguardimmo/api';
import { describeThreadFailure } from '../../api/errors';
import type { ThreadFailure } from '../../api/errors';

const FORBIDDEN: Readonly<Record<string, ThreadFailure>> = {
  role_forbidden: { kind: 'forbidden', message: 'Votre rôle ne permet pas cette action : seuls le titulaire, les administrateurs et les gestionnaires échangent avec les locataires et les mandants.' },
  conversation_kind_unavailable: { kind: 'forbidden', message: 'Les conversations avec les mandants ne sont pas disponibles pour ce type d’organisation.' },
  message_redaction_forbidden: { kind: 'forbidden', message: 'Un gestionnaire ne retire que ses propres messages, dans les 15 minutes qui suivent leur envoi. Demandez à un administrateur.' },
  two_factor_required: { kind: 'forbidden', message: 'Activez la double authentification sur votre compte pour effectuer cette action.' },
  reauthentication_required: { kind: 'forbidden', message: 'Confirmez votre identité avec un code de double authentification de moins de 10 minutes pour continuer.' },
  conversation_muted: { kind: 'readOnly', message: 'L’envoi est restreint sur cette conversation.' },
  conversation_read_only: { kind: 'readOnly', message: 'Cette conversation est en lecture seule.' },
};

const NOT_FOUND: Readonly<Record<string, string>> = {
  conversation_not_found: 'Cette conversation n’existe pas ou n’est plus accessible.',
  conversation_link_not_found: 'Ce bail ou ce mandat n’est pas visible par la personne : vérifiez que son accès est actif, puis réessayez.',
  message_not_found: 'Ce message n’existe plus dans cette conversation.',
  attachment_not_found: 'Cette pièce jointe n’existe plus ou ne vous est plus accessible.',
};

const CONFLICT: Readonly<Record<string, ThreadFailure>> = {
  conversation_open_limit: { kind: 'conflict', message: 'Cette personne a déjà 10 conversations ouvertes avec l’agence. Fermez-en une avant d’en ouvrir une nouvelle.' },
  conversation_busy: { kind: 'conflict', message: 'La conversation est en cours de modification. Réessayez dans un instant : votre message ne sera enregistré qu’une seule fois.' },
  conversation_storage_full: { kind: 'conflict', message: 'Cette conversation ne peut plus recevoir de pièces jointes.' },
  message_redaction_expired: { kind: 'conflict', message: 'Ce message ne peut plus être retiré par son auteur : demandez à un administrateur.' },
  idempotency_key_reused: { kind: 'conflict', message: 'Ce message a déjà été enregistré avec un contenu différent. Modifiez-le pour l’envoyer de nouveau.' },
};

const SUBJECT_RULE = 'L’objet est obligatoire (140 caractères au plus).';
const BODY_RULE = 'Le message est vide ou dépasse 5 000 caractères.';

function invalid(error: ApiError): ThreadFailure | null {
  if (error.code === 'recipient_not_found') {
    return { kind: 'invalid', message: 'Cette personne n’a pas de compte rattaché à sa fiche : invitez-la d’abord, ou écrivez-lui hors de l’application.' };
  }
  if (error.code === 'assignee_invalid') return { kind: 'invalid', message: 'Une conversation ne s’assigne qu’à un membre actif de l’équipe de gestion.' };
  const fields = Object.keys(error.fieldErrors);
  if (fields.includes('reason')) return { kind: 'invalid', message: 'Le motif est obligatoire (5 à 500 caractères).' };
  if (fields.includes('days')) return { kind: 'invalid', message: 'La durée de la restriction est de 1 à 30 jours.' };
  if (fields.includes('subject')) return { kind: 'invalid', message: SUBJECT_RULE };
  if (fields.includes('body')) return { kind: 'invalid', message: BODY_RULE };
  return null;
}

export function describeStaffFailure(error: unknown): ThreadFailure {
  if (error instanceof ApiError) {
    const forbidden = error.status === 403 ? FORBIDDEN[error.code] : undefined;
    if (forbidden) return forbidden;
    const missing = error.status === 404 ? NOT_FOUND[error.code] : undefined;
    if (missing) return { kind: 'notFound', message: missing };
    const conflict = error.status === 409 ? CONFLICT[error.code] : undefined;
    if (conflict) return conflict;
    if (error.status === 422) {
      const specific = invalid(error);
      if (specific !== null) return specific;
    }
  }
  return describeThreadFailure(error);
}

export function staffErrorMessage(error: unknown): string {
  return describeStaffFailure(error).message;
}

const RESEND_SAFE = ['unreachable', 'unavailable', 'other', 'unexpected'];

export function staffSendFailureMessage(error: unknown): string {
  const failure = describeStaffFailure(error);
  return RESEND_SAFE.includes(failure.kind) ? `${failure.message} Si vous renvoyez le message, il ne sera enregistré qu’une seule fois.` : failure.message;
}
