import type {
  AllocationTarget,
  ApprovalDecision,
  Currency,
  DeclineReason,
  FileKind,
  PaymentMethod,
  Priority,
  QuoteKind,
  Responsibility,
  VisitSlot,
} from './model';

export interface CreateInput {
  idempotencyKey: string;
  unitId: string;
  natureTermId: string;
  title: string;
  description: string;
  room: string;
  availability: string;
  priority: Priority;
}

export interface QualifyInput {
  lockVersion: number;
  priority: Priority;
  responsibility: Responsibility;
  natureTermId: string | null;
  dueOn: string;
  estimatedAmount: string;
  currency: Currency;
}

export interface DeclineInput {
  lockVersion: number;
  reason: DeclineReason;
  note: string;
}

export interface EngageInput {
  lockVersion: number;
  basis: 'under_ceiling' | 'emergency';
  reason: string;
}

export interface CompleteInput {
  lockVersion: number;
  completedOn: string;
  note: string;
}

export interface CommentInput {
  text: string;
  visibleToTenant: boolean;
  visibleToOwner: boolean;
}

export interface FileInput {
  file: File;
  kind: FileKind;
  visibleToTenant: boolean;
  visibleToOwner: boolean;
}

export interface VisitInput {
  scheduledOn: string;
  slot: VisitSlot;
  presenceRequired: boolean;
  contactName: string;
  contactPhone: string;
}

export interface QuoteLineInput {
  label: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRateKey: string;
}

export interface QuoteInput {
  reference: string;
  kind: QuoteKind;
  issuedOn: string;
  validUntil: string;
  proposedOn: string;
  message: string;
  fileId: string;
  currency: Currency;
  lines: QuoteLineInput[];
}

export interface DecisionInput {
  decision: ApprovalDecision;
  comment: string;
  proofFileId: string | null;
}

export interface InvoiceTaxInput {
  taxRateKey: string;
  base: string;
  tax: string;
}

export interface SupplierInvoiceInput {
  idempotencyKey: string;
  number: string;
  invoiceOn: string;
  dueOn: string;
  fileId: string;
  currency: Currency;
  taxes: InvoiceTaxInput[];
}

export interface AllocationInput {
  idempotencyKey: string;
  target: AllocationTarget;
  shareAmount: string;
  currency: Currency;
  wearPercent: string;
  basisNote: string;
}

export interface SupplierPaymentInput {
  idempotencyKey: string;
  amount: string;
  currency: Currency;
  method: PaymentMethod;
  paidOn: string;
  reference: string;
}

export interface SupplierInput {
  partyId: string | null;
  supplierId: string | null;
  tradeTermIds: string[];
  preferred: boolean;
  paymentTermsDays: string;
  internalNote: string;
}
