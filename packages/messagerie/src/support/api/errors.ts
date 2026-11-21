import { ApiError } from '@eguardimmo/api';
import { describeThreadFailure } from '../../external/api/errors';
import type { ThreadFailure } from '../../external/api/errors';

export type SupportFailure = ThreadFailure;

const FORBIDDEN: Readonly<Record<string, SupportFailure>> = {
  support_space_forbidden: {
    kind: 'forbidden',
    message: 'Votre compte n’a pas le profil de cet espace : la demande ne peut pas être ouverte depuis ici.',
  },
};

const NOT_FOUND: Readonly<Record<string, string>> = {
  ticket_not_found: 'Cette demande n’existe pas ou ne vous concerne pas.',
  attachment_not_found: 'Cette pièce jointe n’existe plus ou ne vous est plus accessible.',
};

const CONFLICT: Readonly<Record<string, SupportFailure>> = {
  ticket_resolved: {
    kind: 'closed',
    message: 'Cette demande est résolue depuis plus de 14 jours : ouvrez une nouvelle demande.',
  },
  idempotency_key_reused: {
    kind: 'conflict',
    message: 'Ce message a déjà été enregistré avec un contenu différent. Modifiez-le pour l’envoyer de nouveau.',
  },
};

const OPEN_LIMIT_MESSAGE = 'Vous avez atteint le nombre de demandes autorisées (5 par heure, 20 par jour). Réessayez plus tard.';

export function describeSupportFailure(error: unknown, context: 'open' | 'other' = 'other'): SupportFailure {
  if (error instanceof ApiError) {
    const forbidden = error.status === 403 ? FORBIDDEN[error.code] : undefined;
    if (forbidden) return forbidden;
    const notFound = error.status === 404 ? NOT_FOUND[error.code] : undefined;
    if (notFound !== undefined) return { kind: 'notFound', message: notFound };
    const conflict = error.status === 409 ? CONFLICT[error.code] : undefined;
    if (conflict) return conflict;
    if (error.status === 422 && error.code === 'organization_not_member') {
      return { kind: 'invalid', message: 'Vous n’êtes plus membre de cette organisation : la demande ne peut pas être ouverte.' };
    }
    if (error.status === 422 && Object.keys(error.fieldErrors).some((field) => field === 'organization_id' || field === 'space')) {
      return { kind: 'invalid', message: 'La demande ne peut pas être rattachée à cet espace. Rechargez la page.' };
    }
    if (error.status === 429 && context === 'open') return { kind: 'rateLimited', message: OPEN_LIMIT_MESSAGE };
  }
  return describeThreadFailure(error);
}

export function supportErrorMessage(error: unknown, context: 'open' | 'other' = 'other'): string {
  return describeSupportFailure(error, context).message;
}

const RESEND_SAFE: readonly string[] = ['unreachable', 'unavailable', 'other', 'unexpected'];

export function supportSendFailureMessage(error: unknown, context: 'open' | 'other' = 'other'): string {
  const failure = describeSupportFailure(error, context);
  return RESEND_SAFE.includes(failure.kind) ? `${failure.message} Si vous renvoyez le message, il ne sera enregistré qu’une seule fois.` : failure.message;
}
