import { ApiError } from '@eguardimmo/api';
import { describeThreadFailure } from '../../../external/api/errors';
import type { ThreadFailure } from '../../../external/api/errors';

export type ConsoleFailure = ThreadFailure;

const FORBIDDEN: Readonly<Record<string, ConsoleFailure>> = {
  support_access_required: {
    kind: 'forbidden',
    message: 'Accès requis : aucun accès valide de l’organisation ne couvre cette lecture. Demandez son consentement depuis la demande.',
  },
  support_access_review_forbidden: {
    kind: 'forbidden',
    message: 'La revue d’un accès d’urgence revient à un autre opérateur que celui qui l’a ouvert.',
  },
  space_forbidden: { kind: 'forbidden', message: 'Votre compte n’a pas ou plus accès à la console.' },
};

const NOT_FOUND: Readonly<Record<string, string>> = {
  ticket_not_found: 'Cette demande n’existe pas ou n’est plus accessible.',
  support_access_not_found: 'Cet accès n’existe plus. Rechargez la demande.',
  attachment_not_found: 'Cette pièce jointe n’existe plus ou n’est plus accessible.',
  organization_not_found: 'Cette organisation n’existe pas.',
};

const CONFLICT: Readonly<Record<string, ConsoleFailure>> = {
  idempotency_key_reused: {
    kind: 'conflict',
    message: 'Ce message a déjà été enregistré avec un contenu différent. Modifiez-le pour l’envoyer de nouveau.',
  },
  ticket_resolved: { kind: 'closed', message: 'Cette demande est résolue : rouvrez-la pour poursuivre.' },
  support_access_already_open: { kind: 'conflict', message: 'Un accès est déjà demandé ou ouvert pour cette demande.' },
  support_access_not_pending: { kind: 'conflict', message: 'Cet accès a déjà été traité par l’organisation. Rechargez la demande.' },
  support_access_not_emergency: { kind: 'conflict', message: 'Seul un accès d’urgence fait l’objet d’une revue.' },
  support_emergency_review_pending: {
    kind: 'conflict',
    message: 'Votre précédent accès d’urgence à cette organisation n’a pas été revu par un autre opérateur : il doit l’être avant d’en ouvrir un nouveau.',
  },
  support_emergency_organization_busy: { kind: 'conflict', message: 'Un accès d’urgence est déjà ouvert sur cette organisation.' },
};

const UNPROCESSABLE: Readonly<Record<string, string>> = {
  support_access_duration_invalid: 'La durée d’un accès va de 1 à 72 heures.',
  support_access_scope_invalid: 'Le périmètre demandé est invalide.',
  support_access_organization_required: 'Cette demande n’est rattachée à aucune organisation : il n’y a pas d’accès à demander.',
  assignee_not_operator: 'Une demande ne s’assigne qu’à un opérateur actif.',
};

const EMERGENCY_LIMITS: Readonly<Record<string, string>> = {
  support_emergency_cooldown:
    'L’organisation a révoqué un accès d’urgence : aucun nouvel accès sans consentement ne s’ouvre avant la fin du délai de suspension.',
  support_emergency_limit: 'Le nombre d’accès d’urgence ouverts sur cette organisation ces dernières 24 heures est atteint.',
};

export function formatWait(seconds: number | null): string {
  if (seconds === null) return 'un instant';
  if (seconds < 90) return `${String(seconds)} s`;
  if (seconds < 5400) return `${String(Math.ceil(seconds / 60))} min`;
  const hours = Math.ceil(seconds / 3600);
  return hours < 48 ? `${String(hours)} h` : `${String(Math.ceil(hours / 24))} jours`;
}

function invalidFields(error: ApiError): string {
  const fields = Object.keys(error.fieldErrors);
  if (fields.includes('reason')) return 'Le motif doit faire de 10 à 500 caractères.';
  if (fields.includes('basis')) return 'Choisissez le fondement de l’accès d’urgence.';
  if (fields.some((field) => field.startsWith('scopes'))) return 'Choisissez au moins un périmètre parmi la liste proposée.';
  if (fields.includes('status') || fields.includes('priority') || fields.includes('assignee_id')) return 'La valeur choisie est refusée par le serveur. Rechargez la demande.';
  return '';
}

export function describeConsoleFailure(error: unknown): ConsoleFailure {
  if (error instanceof ApiError) {
    if (error.status === 403 && FORBIDDEN[error.code]) return FORBIDDEN[error.code] ?? describeThreadFailure(error);
    if (error.status === 404 && NOT_FOUND[error.code] !== undefined) return { kind: 'notFound', message: NOT_FOUND[error.code] ?? '' };
    if (error.status === 409 && CONFLICT[error.code]) return CONFLICT[error.code] ?? describeThreadFailure(error);
    if (error.status === 422) {
      const known = UNPROCESSABLE[error.code];
      if (known !== undefined) return { kind: 'invalid', message: known };
      const fields = invalidFields(error);
      if (fields !== '') return { kind: 'invalid', message: fields };
    }
    if (error.status === 429 && EMERGENCY_LIMITS[error.code] !== undefined) {
      return { kind: 'rateLimited', message: `${EMERGENCY_LIMITS[error.code] ?? ''} Réessayez dans ${formatWait(error.retryAfterSeconds)}.` };
    }
  }
  return describeThreadFailure(error);
}

export function consoleErrorMessage(error: unknown): string {
  return describeConsoleFailure(error).message;
}

export function isAccessRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === 'support_access_required';
}

const STALE_CODES: readonly string[] = ['support_access_not_pending', 'support_access_not_found', 'support_access_already_open', 'ticket_not_found'];

export function isStaleFailure(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.includes(error.code);
}

const RESEND_SAFE: readonly string[] = ['unreachable', 'unavailable', 'other', 'unexpected'];

export function consoleSendFailureMessage(error: unknown): string {
  const failure = describeConsoleFailure(error);
  return RESEND_SAFE.includes(failure.kind) ? `${failure.message} Si vous renvoyez le message, il ne sera enregistré qu’une seule fois.` : failure.message;
}
