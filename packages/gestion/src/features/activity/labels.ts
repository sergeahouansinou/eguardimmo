import type { BadgeTone } from '@eguardimmo/ui';
import { activityPaths } from './activityPaths';
import type { ActivityActor, ActivitySubject, ActivityType, ActorKind } from './model';

export const typeBadge: Record<ActivityType, { label: string; tone: BadgeTone }> = {
  droits: { label: 'Droits', tone: 'info' },
  paiement: { label: 'Paiement', tone: 'success' },
  document: { label: 'Document', tone: 'neutral' },
  export: { label: 'Export', tone: 'warning' },
  securite: { label: 'Sécurité', tone: 'danger' },
  autre: { label: 'Autre', tone: 'neutral' },
};

export const actorKindLabel: Record<ActorKind, string> = {
  member: 'Membre de l’équipe',
  tenant: 'Locataire',
  owner: 'Propriétaire',
  support: 'Support eGuardImmo',
  system: 'Système',
  other: 'Autre',
};

export const SUBJECT_TYPES: readonly { value: string; label: string }[] = [
  { value: 'property', label: 'Site' },
  { value: 'unit', label: 'Lot' },
  { value: 'lease', label: 'Bail' },
  { value: 'party', label: 'Contact' },
  { value: 'planning_task', label: 'Tâche' },
  { value: 'planning_event', label: 'Événement d’agenda' },
  { value: 'organization_member', label: 'Membre de l’équipe' },
  { value: 'mandate', label: 'Mandat' },
  { value: 'expense', label: 'Dépense' },
  { value: 'invoice', label: 'Facture' },
];

export const subjectTypeLabel = (type: string): string => SUBJECT_TYPES.find((candidate) => candidate.value === type)?.label ?? type.replaceAll('_', ' ');

const SUBJECT_LINKS: Readonly<Record<string, (id: string) => string>> = {
  lease: activityPaths.lease,
  unit: activityPaths.unit,
  property: activityPaths.property,
  party: activityPaths.party,
  planning_task: activityPaths.task,
  planning_event: activityPaths.event,
};

export const subjectHref = (subject: ActivitySubject): string | null => SUBJECT_LINKS[subject.type]?.(subject.id) ?? null;

export function actorText(actor: ActivityActor): string {
  const name = actor.name?.trim() ?? '';
  const base = name === '' ? actorKindLabel[actor.kind] : name;
  return actor.active === false ? `${base} (compte supprimé ou désactivé)` : base;
}
