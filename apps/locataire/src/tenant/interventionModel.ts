export const TENANT_STATES = ['reported', 'in_progress', 'done', 'declined', 'cancelled'] as const;
export type TenantState = (typeof TENANT_STATES)[number];

export const VISIT_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type VisitSlot = (typeof VISIT_SLOTS)[number];

export const VISIT_STATUSES = ['proposed', 'confirmed', 'reschedule_requested', 'done', 'cancelled', 'no_show'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const REPORTED_URGENCIES = ['urgent', 'soon', 'normal'] as const;
export type ReportedUrgency = (typeof REPORTED_URGENCIES)[number];

export interface InterventionVisit {
  id: string;
  scheduledOn: string;
  slot: VisitSlot;
  presenceRequired: boolean;
  status: VisitStatus;
  requestedOn: string | null;
  requestedSlot: VisitSlot | null;
  contactName: string | null;
  contactPhone: string | null;
}

export interface InterventionEvent {
  id: string;
  kind: string;
  author: 'tenant' | 'team';
  text: string;
  createdAt: string;
}

export interface InterventionFile {
  id: string;
  kind: string;
  uploadedBy: 'tenant' | 'team';
  createdAt: string | null;
}

export interface TenantIntervention {
  id: string;
  reference: string;
  state: TenantState;
  nature: { key: string | null; label: string | null };
  title: string;
  description: string;
  room: string | null;
  availability: string | null;
  reportedUrgency: ReportedUrgency | null;
  place: string;
  reportedOn: string;
  decline: { reason: string; note: string | null } | null;
  completedOn: string | null;
  visits: InterventionVisit[];
  cancellable: boolean;
  events: InterventionEvent[] | null;
  files: InterventionFile[] | null;
}

export interface NatureOption {
  id: string;
  key: string;
  label: string;
}

export interface UnitOption {
  id: string;
  label: string;
}

export interface LeaseReportOptions {
  leaseId: string;
  label: string;
  units: UnitOption[];
  commonAreaAllowed: boolean;
  natures: NatureOption[];
}

export interface ReportInput {
  leaseId: string;
  unitId: string | null;
  commonArea: boolean;
  natureTermId: string;
  title: string;
  description: string;
  room: string;
  reportedUrgency: ReportedUrgency;
  availability: string;
  idempotencyKey: string;
}
