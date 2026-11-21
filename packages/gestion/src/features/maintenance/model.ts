import type { Currency } from '../../format/money';

export type { Currency };

export interface Money {
  amount: number;
  currency: Currency;
}

export const INTERVENTION_STATUSES = ['reported', 'qualified', 'declined', 'cancelled', 'quoting', 'awaiting_approval', 'approved', 'scheduled', 'in_progress', 'completed', 'invoiced', 'closed'] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export const PRIORITIES = ['urgent', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REPORTED_URGENCIES = ['urgent', 'soon', 'normal'] as const;
export type ReportedUrgency = (typeof REPORTED_URGENCIES)[number];

export const RESPONSIBILITIES = ['owner', 'tenant', 'shared', 'undetermined'] as const;
export type Responsibility = (typeof RESPONSIBILITIES)[number];

export const ORIGINS = ['tenant', 'team'] as const;
export type Origin = (typeof ORIGINS)[number];

export const APPROVAL_BASES = ['under_ceiling', 'owner_approved', 'emergency', 'self_managed'] as const;
export type ApprovalBasis = (typeof APPROVAL_BASES)[number];

export const APPROVAL_STATUSES = ['pending', 'accepted', 'refused', 'question', 'expired', 'withdrawn'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_DECISIONS = ['accept', 'refuse', 'question'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const DECIDED_VIA = ['owner_space', 'agency_recorded'] as const;
export type DecidedVia = (typeof DECIDED_VIA)[number];

export const FILE_KINDS = ['photo_before', 'photo_after', 'quote', 'invoice', 'report', 'proof', 'other'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const QUOTE_KINDS = ['initial', 'supplement'] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number];

export const QUOTE_STATUSES = ['received', 'submitted', 'accepted', 'refused', 'expired', 'superseded'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const SUPPLIER_INVOICE_STATUSES = ['recorded', 'allocated', 'cancelled'] as const;
export type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['transfer', 'cheque', 'cash', 'card', 'direct_debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SUPPLIER_STATUSES = ['active', 'suspended', 'archived'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const VISIT_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type VisitSlot = (typeof VISIT_SLOTS)[number];

export const VISIT_STATUSES = ['proposed', 'confirmed', 'reschedule_requested', 'done', 'cancelled', 'no_show'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const ACTOR_KINDS = ['team', 'owner', 'tenant', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const ALLOCATION_TARGETS = ['owner', 'deposit'] as const;
export type AllocationTarget = (typeof ALLOCATION_TARGETS)[number];

export const DECLINE_REASONS = ['duplicate', 'out_of_scope', 'not_an_issue', 'tenant_responsibility', 'other'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'O'] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export interface Named {
  id: string;
  name: string | null;
}

export interface UnitRef {
  id: string;
  reference: string;
  propertyName: string | null;
}

export interface VisitSummary {
  id: string;
  scheduledOn: string;
  slot: VisitSlot;
  status: VisitStatus;
}

export interface Intervention {
  id: string;
  reference: string;
  origin: Origin;
  status: InterventionStatus;
  priority: Priority;
  reportedUrgency: ReportedUrgency | null;
  natureTermId: string;
  title: string;
  description: string;
  room: string | null;
  availability: string | null;
  propertyId: string | null;
  unitId: string | null;
  unit: UnitRef | null;
  leaseId: string | null;
  mandateId: string | null;
  mandant: Named | null;
  reporter: Named | null;
  supplier: Named | null;
  responsibility: Responsibility;
  reportedOn: string;
  dueOn: string | null;
  estimatedAmount: Money | null;
  ceilingAmount: Money | null;
  approvalBasis: ApprovalBasis | null;
  emergencyReason: string | null;
  declineReason: DeclineReason | null;
  declineNote: string | null;
  completedOn: string | null;
  completionNote: string | null;
  closedAt: string | null;
  followsInterventionId: string | null;
  visits: VisitSummary[];
  lockVersion: number;
  createdAt: string | null;
}

export interface InterventionEvent {
  id: string;
  kind: string;
  actorKind: ActorKind;
  text: string | null;
  visibleToOwner: boolean;
  visibleToTenant: boolean;
  createdAt: string;
}

export interface InterventionFile {
  id: string;
  kind: FileKind;
  uploadedByKind: ActorKind;
  visibleToOwner: boolean;
  visibleToTenant: boolean;
  createdAt: string | null;
}

export interface Visit {
  id: string;
  supplierPartyId: string | null;
  scheduledOn: string;
  slot: VisitSlot;
  presenceRequired: boolean;
  status: VisitStatus;
  requestedOn: string | null;
  requestedSlot: VisitSlot | null;
  contactName: string | null;
  contactPhone: string | null;
  lockVersion: number;
}

export interface QuoteLine {
  position: number;
  label: string;
  quantityMilli: number;
  unit: string | null;
  unitPrice: number;
  netAmount: number;
  taxCategory: TaxCategory;
  taxRatePcm: number;
}

export interface Quote {
  id: string;
  supplierPartyId: string | null;
  reference: string;
  kind: QuoteKind;
  status: QuoteStatus;
  issuedOn: string;
  validUntil: string | null;
  proposedOn: string | null;
  message: string | null;
  totalNet: Money;
  totalTax: Money;
  totalGross: Money;
  lines: QuoteLine[];
}

export interface QuoteSummary extends Omit<Quote, 'lines'> {
  interventionId: string;
  lockVersion: number;
  intervention: { id: string; reference: string; status: InterventionStatus; unitId: string | null } | null;
  approval: { status: ApprovalStatus; ceilingAmount: Money; decideBefore: string } | null;
}

export interface Approval {
  id: string;
  quoteId: string | null;
  amount: Money;
  ceilingAmount: Money | null;
  status: ApprovalStatus;
  requestedAt: string;
  decideBefore: string;
  decidedAt: string | null;
  decidedVia: DecidedVia | null;
  comment: string | null;
  proofFileId: string | null;
  lockVersion: number;
}

export interface Allocation {
  id: string;
  target: AllocationTarget;
  shareAmount: Money;
  wearBasisPoints: number | null;
  chargedAmount: Money;
  basisNote: string | null;
  cancelledAt: string | null;
}

export interface SupplierPayment {
  id: string;
  amount: Money;
  method: PaymentMethod;
  paidOn: string;
  reference: string | null;
  cancelledAt: string | null;
}

export interface InvoiceTax {
  category: TaxCategory;
  ratePcm: number;
  baseAmount: number;
  taxAmount: number;
}

export interface SupplierInvoice {
  id: string;
  supplierPartyId: string | null;
  number: string;
  invoiceOn: string;
  dueOn: string | null;
  totalNet: Money;
  totalTax: Money;
  totalGross: Money;
  status: SupplierInvoiceStatus;
  exceedsApprovedAmount: boolean;
  taxes: InvoiceTax[];
  allocations: Allocation[];
  payments: SupplierPayment[];
  lockVersion: number;
}

export interface InterventionDetail extends Intervention {
  currency: Currency;
  committedAmount: Money | null;
  events: InterventionEvent[];
  files: InterventionFile[];
  visits: Visit[];
  quotes: Quote[];
  approvals: Approval[];
  invoices: SupplierInvoice[];
}

export interface Supplier {
  id: string;
  partyId: string;
  name: string | null;
  anonymized: boolean;
  status: SupplierStatus;
  preferred: boolean;
  paymentTermsDays: number | null;
  internalNote: string | null;
  tradeTermIds: string[];
  lockVersion: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InterventionQuery {
  cursor?: string | null;
  perPage?: number;
  status?: InterventionStatus;
  priority?: Priority;
  origin?: Origin;
  overdue?: boolean;
  search?: string;
  supplierPartyId?: string;
  unitId?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface QuoteQuery {
  cursor?: string | null;
  perPage?: number;
  statuses?: readonly QuoteStatus[];
  interventionId?: string;
  supplierPartyId?: string;
}

export interface SupplierQuery {
  cursor?: string | null;
  status?: SupplierStatus;
}

export interface Term {
  id: string;
  key: string;
  label: string;
  ratePcm: number | null;
  category: TaxCategory | null;
}

export interface UnitChoice {
  id: string;
  label: string;
}

export interface PartyChoice {
  id: string;
  name: string;
}

export type * from './inputs';

export interface Replayable {
  id: string;
  replayed: boolean;
}

export interface MaintenancePermissions {
  available: boolean;
  write: boolean;
  finance: boolean;
  settle: boolean;
}
