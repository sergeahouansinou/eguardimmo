'use client';

import type { ConfirmProof } from '../../reauth/proof';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type {
  ApproveRequestInput,
  ClosedPeriod,
  CloseResult,
  ExecuteInput,
  FeeQuery,
  FeeStatement,
  HoldQuery,
  MandantAccount,
  OwnerFundsPermissions,
  Page,
  PayoutAccountRequest,
  PayoutBatch,
  PayoutHold,
  PayoutItem,
  PayoutPreview,
  PayoutProof,
  PayoutRequestQuery,
  PlaceHoldInput,
  TransferInput,
  TrustCoverage,
  TrustDeposit,
  TrustTransfer,
} from './model';
import type { SimulationSource } from './simulation/source';

export interface OwnerFundsSource extends SimulationSource {
  readonly permissions: OwnerFundsPermissions;
  preview: (limit?: number) => Promise<PayoutPreview>;
  mandantAccount: (mandantId: string) => Promise<MandantAccount>;
  partyName: (partyId: string) => Promise<string | null>;
  batches: (cursor: string | null) => Promise<Page<PayoutBatch>>;
  batch: (id: string) => Promise<PayoutBatch>;
  holds: (query: HoldQuery) => Promise<Page<PayoutHold>>;
  fees: (query: FeeQuery) => Promise<Page<FeeStatement>>;
  coverage: () => Promise<TrustCoverage>;
  deposits: (cursor: string | null) => Promise<Page<TrustDeposit>>;
  periods: () => Promise<ClosedPeriod[]>;
  createBatch: (mandantIds: readonly string[] | null, key: string) => Promise<PayoutBatch>;
  includeItem: (batchId: string, itemId: string, lockVersion: number, key: string) => Promise<PayoutBatch>;
  excludeItem: (batchId: string, itemId: string, lockVersion: number, key: string) => Promise<PayoutBatch>;
  placeHold: (input: PlaceHoldInput, key: string) => Promise<PayoutHold>;
  releaseHold: (holdId: string, key: string) => Promise<PayoutHold>;
  validateBatch: (batchId: string, lockVersion: number, key: string) => Promise<PayoutBatch>;
  cancelBatch: (batchId: string, reason: string, lockVersion: number, key: string) => Promise<PayoutBatch>;
  executeItem: (batchId: string, itemId: string, input: ExecuteInput, key: string) => Promise<PayoutItem>;
  failItem: (batchId: string, itemId: string, reason: string, key: string) => Promise<PayoutItem>;
  returnItem: (batchId: string, itemId: string, reason: string, key: string) => Promise<PayoutItem>;
  withdrawFees: (input: TransferInput, key: string) => Promise<TrustTransfer>;
  requestDeposit: (input: TransferInput, key: string) => Promise<TrustDeposit>;
  confirmDeposit: (depositId: string, key: string) => Promise<TrustDeposit>;
  exportBatch: (batchId: string) => Promise<Blob>;
  closeMonth: (month: string, key: string) => Promise<CloseResult>;
  payoutRequests: (query: PayoutRequestQuery) => Promise<Page<PayoutAccountRequest>>;
  approvePayoutRequest: (requestId: string, input: ApproveRequestInput) => Promise<PayoutAccountRequest>;
  rejectPayoutRequest: (requestId: string, lockVersion: number, reason: string) => Promise<PayoutAccountRequest>;
  payoutProof: (requestId: string) => Promise<PayoutProof>;
  confirmTwoFactor: ConfirmProof;
}

const context = createSourceContext<OwnerFundsSource>('Fonds des mandants', () => {
  throw new MissingSourceError('Fonds des mandants');
});

export const OwnerFundsSourceProvider = context.SourceProvider;
export const useOwnerFundsSource = context.useSource;
