import type { ActivityEntry } from '@/console/schemas';

export const SYSTEM_ACTOR = 'Système';
export const UNKNOWN_ACTOR = 'Compte inconnu';

export function actorLabel(actor: ActivityEntry['actor']): string {
  if (actor === null) return SYSTEM_ACTOR;
  return actor.name ?? UNKNOWN_ACTOR;
}

export function entityLabel(subject: ActivityEntry['subject']): string {
  if (subject === null) return '—';
  return subject.id === null ? subject.type : `${subject.type} · ${subject.id.slice(0, 8)}`;
}

export const REDACTED_TEXT = 'Contenu masqué : accès de support requis';

export function actorText(entry: Pick<ActivityEntry, 'actor' | 'redacted'>): string {
  return entry.redacted ? 'Masqué' : actorLabel(entry.actor);
}
