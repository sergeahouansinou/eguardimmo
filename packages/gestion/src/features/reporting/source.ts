'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type {
  AgencyAlerts,
  AgencyKpis,
  AgencyPayouts,
  Aging,
  CreateOutcome,
  CreateReportsInput,
  LandlordHome,
  MandantOption,
  Report,
  ReportChanges,
  ReportPage,
  ReportQuery,
  ReportingPermissions,
  Statement,
} from './model';

export interface ReportingSource {
  readonly permissions: ReportingPermissions;
  agencyKpis: (month?: string) => Promise<AgencyKpis>;
  agencyPayouts: () => Promise<AgencyPayouts>;
  agencyAlerts: () => Promise<AgencyAlerts>;
  landlordHome: (month?: string) => Promise<LandlordHome>;
  aging: () => Promise<Aging>;
  reports: (query: ReportQuery) => Promise<ReportPage>;
  report: (id: string) => Promise<Report>;
  mandants: () => Promise<MandantOption[]>;
  partyName: (partyId: string) => Promise<string | null>;
  createReports: (input: CreateReportsInput, key: string) => Promise<CreateOutcome[]>;
  updateReport: (id: string, lockVersion: number, changes: ReportChanges) => Promise<Report>;
  generateReport: (id: string) => Promise<Report>;
  discardReport: (id: string) => Promise<Report>;
  publishReport: (id: string) => Promise<Report>;
  scheduleReport: (id: string, at: string) => Promise<Report>;
  unscheduleReport: (id: string) => Promise<Report>;
  rectifyReport: (id: string, reason: string) => Promise<Report>;
  pdf: (id: string) => Promise<Blob>;
  linesCsv: (id: string) => Promise<Blob>;
  statement: (mandantId: string, from: string, to: string) => Promise<Statement>;
  statementCsv: (mandantId: string, from: string, to: string) => Promise<Blob>;
}

const context = createSourceContext<ReportingSource>('Comptes rendus', () => {
  throw new MissingSourceError('Comptes rendus');
});

export const ReportingSourceProvider = context.SourceProvider;
export const useReportingSource = context.useSource;
