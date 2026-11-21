import type { Page } from '../orgapi/model';

export const ACTIVITY_TYPES = ['droits', 'paiement', 'document', 'export', 'securite', 'autre'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTOR_KINDS = ['member', 'tenant', 'owner', 'support', 'system', 'other'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const MAX_RANGE_DAYS = 366;
export const PAGE_SIZE = 25;

export interface ActivityActor {
  kind: ActorKind;
  id: string | null;
  name: string | null;
  active: boolean | null;
}

export interface ActivitySubject {
  type: string;
  id: string;
}

export interface ActivityEntry {
  id: string;
  occurredAt: string;
  type: ActivityType;
  label: string;
  actor: ActivityActor;
  subject: ActivitySubject | null;
  action: string | null;
  ip: string | null;
  device: string | null;
}

export interface ActivityChange {
  field: string;
  before: string;
  after: string;
}

export interface ActivityMetadataItem {
  key: string;
  value: string;
}

export interface ActivityDetail extends ActivityEntry {
  action: string;
  reference: string | null;
  changes: ActivityChange[];
  metadata: ActivityMetadataItem[];
}

export interface ActivityFilters {
  from: string | null;
  to: string | null;
  actorId: string | null;
  type: ActivityType | null;
  subjectType: string | null;
  subjectId: string | null;
}

export interface ActivityQuery extends ActivityFilters {
  cursor: string | null;
}

export type ActivityPage = Page<ActivityEntry>;

export const EMPTY_FILTERS: ActivityFilters = { from: null, to: null, actorId: null, type: null, subjectType: null, subjectId: null };
