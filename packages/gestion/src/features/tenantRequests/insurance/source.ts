'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Page } from '../shared/model';
import type { InsuranceOverview, InsuranceQuery, InsuranceSubmission, RejectionReason } from './model';

export interface InsuranceSource {
  list: (query: InsuranceQuery) => Promise<Page<InsuranceSubmission>>;
  overview: (leaseId: string) => Promise<InsuranceOverview>;
  accept: (id: string) => Promise<InsuranceSubmission>;
  reject: (id: string, reason: RejectionReason, note: string | null) => Promise<InsuranceSubmission>;
  remind: (leaseId: string) => Promise<void>;
  downloadAttestation: (submissionId: string) => Promise<Blob>;
}

const context = createSourceContext<InsuranceSource>('Assurances des locataires', () => {
  throw new MissingSourceError('Assurances des locataires');
});

export const InsuranceSourceProvider = context.SourceProvider;
export const useInsuranceSource = context.useSource;
