import type { BaremeInput, BatchMemberInput, BlockInput, PlanInput, PreviewPaymentInput, RecordPaymentInput, RejectPaymentInput, ReminderInput, ValidateLotInput } from "./inputs";
import type { SaveBaremeResult } from "./server/commandsFees";
import type { RecordPaymentResult } from "./server/commandsPayments";
import type { ValidateLotResult } from "./server/commandsTransfers";

export interface FinancesSource {
  statements: (period: string) => Promise<unknown>;
  encaissements: (period: string) => Promise<unknown>;
  openInstallments: () => Promise<unknown>;
  previewPayment: (input: PreviewPaymentInput) => Promise<unknown>;
  recordPayment: (input: RecordPaymentInput) => Promise<RecordPaymentResult>;
  reconcilePayment: (input: { paymentId: string }) => Promise<void>;
  rejectPayment: (input: RejectPaymentInput) => Promise<void>;
  impayes: () => Promise<unknown>;
  impayeDetail: (lotId: string) => Promise<unknown>;
  sendReminders: (input: ReminderInput) => Promise<{ sent: number }>;
  proposePlan: (input: PlanInput) => Promise<void>;
  prepareNotice: (input: { lotId: string }) => Promise<void>;
  informMandant: (input: { lotId: string }) => Promise<void>;
  reversements: () => Promise<unknown>;
  lot: () => Promise<unknown>;
  reversement: (mandantId: string) => Promise<unknown>;
  prepareLot: () => Promise<void>;
  includeInLot: (input: { mandantId: string }) => Promise<void>;
  removeFromLot: (input: BatchMemberInput) => Promise<void>;
  validateLot: (input: ValidateLotInput) => Promise<ValidateLotResult>;
  blockReversement: (input: BlockInput) => Promise<void>;
  unblockReversement: (input: { mandantId: string }) => Promise<void>;
  honoraires: (period: string) => Promise<unknown>;
  baremes: () => Promise<unknown>;
  simulateBareme: (input: BaremeInput) => Promise<unknown>;
  saveBareme: (input: BaremeInput) => Promise<SaveBaremeResult>;
}
