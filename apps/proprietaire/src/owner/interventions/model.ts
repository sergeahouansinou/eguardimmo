import type { AgencyRef, Money } from "../shared/model";

export interface OwnerIntervention {
  id: string;
  reference: string;
  status: string;
  priority: string;
  natureLabel: string | null;
  title: string;
  agency: AgencyRef;
  propertyName: string | null;
  unitReference: string | null;
  commonArea: boolean;
  supplierName: string | null;
  responsibility: string;
  approvalBasis: string | null;
  estimatedAmount: Money | null;
  reportedOn: string;
  dueOn: string | null;
  completedOn: string | null;
  closedAt: string | null;
}

export interface InterventionVisit {
  id: string;
  scheduledOn: string;
  slot: string;
  status: string;
}

export interface InterventionEvent {
  id: string;
  kind: string;
  author: string;
  text: string | null;
  createdAt: string;
}

export interface InterventionFile {
  id: string;
  kind: string;
  name: string;
  createdAt: string | null;
}

export interface QuoteLine {
  position: number;
  label: string;
  quantityMilli: number;
  unit: string | null;
  unitPrice: Money;
  netAmount: Money;
  taxRatePcm: number;
}

export interface InterventionQuote {
  id: string;
  reference: string | null;
  kind: string;
  status: string;
  issuedOn: string;
  validUntil: string | null;
  proposedOn: string | null;
  totalNet: Money | null;
  totalTax: Money | null;
  totalGross: Money | null;
  lines: QuoteLine[];
}

export const APPROVAL_DECISIONS = ["accept", "refuse", "question"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export interface InterventionApproval {
  id: string;
  lockVersion: number;
  quoteFingerprint: string;
  statementVersion: string | null;
  quoteId: string | null;
  status: string;
  amount: Money | null;
  ceilingAmount: Money | null;
  requestedAt: string;
  decideBefore: string;
  decidedAt: string | null;
  decidedVia: string | null;
  comment: string | null;
}

export interface SupplierInvoice {
  id: string;
  number: string | null;
  status: string;
  invoiceOn: string;
  dueOn: string | null;
  totalNet: Money | null;
  totalTax: Money | null;
  totalGross: Money | null;
}

export interface InvoiceAllocation {
  id: string;
  invoiceId: string;
  chargedAmount: Money | null;
  createdAt: string | null;
}

export interface OwnerInterventionDetail extends OwnerIntervention {
  description: string | null;
  emergencyReason: string | null;
  visits: InterventionVisit[];
  events: InterventionEvent[];
  files: InterventionFile[];
  quotes: InterventionQuote[];
  approvals: InterventionApproval[];
  invoices: SupplierInvoice[];
  allocations: InvoiceAllocation[];
}

export interface ApprovalOutcome {
  id: string;
  status: string;
  decidedAt: string | null;
  replayed: boolean;
}
