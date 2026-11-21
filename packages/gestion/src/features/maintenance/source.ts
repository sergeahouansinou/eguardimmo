'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type {
  AllocationInput,
  CommentInput,
  CompleteInput,
  CreateInput,
  DeclineInput,
  DecisionInput,
  EngageInput,
  FileInput,
  Intervention,
  InterventionDetail,
  InterventionQuery,
  MaintenancePermissions,
  Page,
  PartyChoice,
  QualifyInput,
  QuoteInput,
  QuoteQuery,
  QuoteSummary,
  Replayable,
  Supplier,
  SupplierInput,
  SupplierInvoiceInput,
  SupplierPaymentInput,
  SupplierQuery,
  Term,
  UnitChoice,
  VisitInput,
} from './model';

export interface MaintenanceSource {
  readonly permissions: MaintenancePermissions;
  interventions: (query: InterventionQuery) => Promise<Page<Intervention>>;
  intervention: (id: string) => Promise<InterventionDetail>;
  create: (input: CreateInput) => Promise<Replayable>;
  qualify: (id: string, input: QualifyInput) => Promise<void>;
  decline: (id: string, input: DeclineInput) => Promise<void>;
  cancel: (id: string, lockVersion: number) => Promise<void>;
  assign: (id: string, lockVersion: number, supplierPartyId: string) => Promise<void>;
  engage: (id: string, input: EngageInput) => Promise<void>;
  complete: (id: string, input: CompleteInput) => Promise<void>;
  close: (id: string, lockVersion: number, noInvoiceReason: string) => Promise<void>;
  reopen: (id: string, lockVersion: number) => Promise<void>;
  comment: (id: string, input: CommentInput) => Promise<void>;
  uploadFile: (id: string, input: FileInput) => Promise<string>;
  downloadFile: (id: string, fileId: string) => Promise<Blob>;
  shareFile: (id: string, fileId: string, visibleToOwner: boolean) => Promise<void>;
  addVisit: (id: string, input: VisitInput) => Promise<void>;
  confirmVisit: (id: string, visitId: string) => Promise<void>;
  markVisitDone: (id: string, visitId: string) => Promise<void>;
  cancelVisit: (id: string, visitId: string) => Promise<void>;
  markVisitNoShow: (id: string, visitId: string) => Promise<void>;
  addQuote: (id: string, input: QuoteInput) => Promise<void>;
  submitQuote: (id: string, quoteId: string) => Promise<void>;
  acceptQuote: (id: string, quoteId: string) => Promise<void>;
  refuseQuote: (id: string, quoteId: string) => Promise<void>;
  recordDecision: (id: string, approvalId: string, input: DecisionInput) => Promise<Replayable>;
  withdrawApproval: (id: string, approvalId: string) => Promise<void>;
  recordInvoice: (id: string, input: SupplierInvoiceInput) => Promise<Replayable>;
  cancelInvoice: (id: string, invoiceId: string) => Promise<void>;
  allocate: (id: string, invoiceId: string, input: AllocationInput) => Promise<Replayable>;
  cancelAllocation: (allocationId: string) => Promise<void>;
  recordPayment: (id: string, invoiceId: string, input: SupplierPaymentInput) => Promise<Replayable>;
  cancelPayment: (paymentId: string) => Promise<void>;
  quotes: (query: QuoteQuery) => Promise<Page<QuoteSummary>>;
  supplierChoices: () => Promise<PartyChoice[]>;
  suppliers: (query: SupplierQuery) => Promise<Page<Supplier>>;
  saveSupplier: (input: SupplierInput) => Promise<void>;
  changeSupplierStatus: (supplierId: string, action: 'suspend' | 'activate' | 'archive') => Promise<void>;
  units: (search: string) => Promise<UnitChoice[]>;
  parties: () => Promise<PartyChoice[]>;
  natureTerms: () => Promise<Term[]>;
  taxRates: () => Promise<Term[]>;
}

const context = createSourceContext<MaintenanceSource>('Interventions', () => {
  throw new MissingSourceError('Interventions');
});

export const MaintenanceSourceProvider = context.SourceProvider;
export const useMaintenanceSource = context.useSource;
