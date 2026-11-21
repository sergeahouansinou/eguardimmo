'use client';

import type { Currency } from '../../format/money';
import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { Acquisition, AcquisitionInput, AcquisitionUpdate, AttestationInput, FeeInput, Loan, LoanFilters, LoanInput, PrepaymentInput, Schedule } from './model';

export interface InvestmentsSource {
  currency: () => Promise<Currency | null>;
  loans: (filters: LoanFilters) => Promise<Loan[]>;
  loan: (id: string) => Promise<Loan>;
  schedule: (id: string) => Promise<Schedule>;
  createLoan: (input: LoanInput, key: string) => Promise<Loan>;
  prepay: (id: string, input: PrepaymentInput) => Promise<Loan>;
  importSchedule: (id: string, file: File, lockVersion: number) => Promise<Loan>;
  addFee: (id: string, input: FeeInput) => Promise<void>;
  addAttestation: (id: string, input: AttestationInput) => Promise<void>;
  voidLoan: (id: string, reason: string, lockVersion: number) => Promise<Loan>;
  acquisitions: (propertyId: string | null) => Promise<Acquisition[]>;
  createAcquisition: (input: AcquisitionInput, key: string) => Promise<Acquisition>;
  updateAcquisition: (id: string, input: AcquisitionUpdate) => Promise<Acquisition>;
}

const context = createSourceContext<InvestmentsSource>('Prêts et coût de revient', () => {
  throw new MissingSourceError('Prêts et coût de revient');
});

export const InvestmentsSourceProvider = context.SourceProvider;
export const useInvestmentsSource = context.useSource;
