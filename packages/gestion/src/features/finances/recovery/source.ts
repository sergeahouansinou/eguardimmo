'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type {
  ActInput,
  ActQuery,
  Bailiff,
  Bundle,
  CaseQuery,
  CaseStatus,
  CaseSummary,
  OpenCaseInput,
  Page,
  ReceivableIds,
  RecoveryAct,
  RecoveryCase,
  RecoveryPermissions,
  Transmission,
  TransmitInput,
  UnpaidPageResult,
  UnpaidQuery,
} from './model';

export interface RecoverySource {
  readonly permissions: RecoveryPermissions;
  unpaid: (query: UnpaidQuery) => Promise<UnpaidPageResult>;
  cases: (query: CaseQuery) => Promise<Page<CaseSummary>>;
  caseDetail: (id: string) => Promise<RecoveryCase>;
  openCase: (input: OpenCaseInput) => Promise<RecoveryCase>;
  addItems: (caseId: string, ids: ReceivableIds) => Promise<RecoveryCase>;
  removeItem: (caseId: string, itemId: string) => Promise<RecoveryCase>;
  changeStatus: (caseId: string, status: CaseStatus, reason: string) => Promise<RecoveryCase>;
  acts: (caseId: string, query: ActQuery) => Promise<Page<RecoveryAct>>;
  addAct: (caseId: string, input: ActInput) => Promise<RecoveryAct>;
  generateBundle: (caseId: string) => Promise<Bundle>;
  bundle: (id: string) => Promise<Bundle>;
  downloadBundle: (id: string) => Promise<Blob>;
  bailiffs: () => Promise<Bailiff[]>;
  transmit: (bundleId: string, input: TransmitInput) => Promise<Transmission>;
  revoke: (transmissionId: string, reason: string) => Promise<Transmission>;
  resend: (transmissionId: string, validDays: number) => Promise<Transmission>;
}

const context = createSourceContext<RecoverySource>('Recouvrement', () => {
  throw new MissingSourceError('Recouvrement');
});

export const RecoverySourceProvider = context.SourceProvider;
export const useRecoverySource = context.useSource;
