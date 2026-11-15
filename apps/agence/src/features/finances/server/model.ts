export const CURRENT_PERIOD = "2026-11";

export type PaymentMode = "virement" | "cheque" | "prelevement" | "especes";
export type PaymentStatus = "recu" | "a_rapprocher" | "rejete";
export type FeeBase = "encaisses" | "hors_charges";
export type FeeCollection = "reversement" | "encaissement";
export type ReminderChannel = "email" | "sms" | "courrier";
export type CaseEventKind = "echeance" | "relance" | "appel" | "mandant" | "message" | "mise_en_demeure" | "echeancier" | "paiement" | "rejet";
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface Installment {
  id: string;
  lotId: string;
  period: string;
  dueOn: string;
  calledMinor: number;
  rentMinor: number;
  chargesMinor: number;
}

export interface Payment {
  id: string;
  installmentId: string;
  lotId: string;
  receivedOn: string;
  mode: PaymentMode;
  reference: string;
  note: string;
  amountMinor: number;
  feeMinor: number;
  status: PaymentStatus;
  receipt: boolean;
  notifyTenant: boolean;
  notifyMandant: boolean;
  rejectionReason: string | null;
}

export interface FeeScheme {
  id: string;
  mandantId: string;
  rateBp: number;
  base: FeeBase;
  minFeeMinor: number;
  collection: FeeCollection;
  relocationPercent: number;
  worksBp: number;
  effectiveFrom: string;
  status: "en_vigueur" | "a_signer";
}

export interface Amendment {
  id: string;
  mandantId: string;
  schemeId: string;
  createdOn: string;
}

export interface CaseEvent {
  id: string;
  kind: CaseEventKind;
  date: string;
  title: string;
  detail: string;
  badge: { label: string; tone: BadgeTone } | null;
}

export interface PlanLine {
  dueOn: string;
  amountMinor: number;
}

export interface UnpaidCase {
  lotId: string;
  status: "ouvert" | "clos";
  events: CaseEvent[];
  plan: { proposedOn: string; lines: PlanLine[] } | null;
  noticeOn: string | null;
}

export interface ReversementRecord {
  id: string;
  mandantId: string;
  period: string;
  paidOn: string;
  lots: number;
  collectedMinor: number;
  feeMinor: number;
  netMinor: number;
}

export interface TransferBatch {
  id: string;
  period: string;
  status: "brouillon" | "valide";
  mandantIds: string[];
  executionOn: string;
  validatedAt: string | null;
  idempotencyKey: string | null;
}

export interface MandantBlock {
  mandantId: string;
  reason: string;
  blockedOn: string;
}

export interface FinancesState {
  installments: Installment[];
  payments: Payment[];
  schemes: FeeScheme[];
  amendments: Amendment[];
  cases: UnpaidCase[];
  records: ReversementRecord[];
  batches: TransferBatch[];
  blocks: MandantBlock[];
  sequence: number;
}
