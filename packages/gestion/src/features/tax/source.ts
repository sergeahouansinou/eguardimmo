'use client';

import { MissingSourceError, createSourceContext } from '../locataires/kit/sourceContext';
import type { GenerationResult, MandantChoice, RectificationInput, TaxIncome, TaxPage, TaxQuery, TaxSummary } from './model';

export interface TaxDataSource {
  rentalIncome: (year: number, householdComplete: boolean) => Promise<TaxIncome>;
  summaries: (query: TaxQuery) => Promise<TaxPage>;
  summary: (id: string) => Promise<TaxSummary>;
  createSummary: (input: { incomeYear: number; householdComplete: boolean }, key: string) => Promise<TaxSummary>;
  rectifySummary: (id: string, input: RectificationInput, key: string) => Promise<TaxSummary>;
  summaryPdf: (id: string) => Promise<Blob>;
  summaryCsv: (id: string) => Promise<Blob>;
  mandants: () => Promise<MandantChoice[]>;
  statements: (query: TaxQuery) => Promise<TaxPage>;
  statement: (id: string) => Promise<TaxSummary>;
  generateStatements: (input: { incomeYear: number; mandantIds: string[] }, key: string) => Promise<GenerationResult[]>;
  publishStatement: (id: string, lockVersion: number) => Promise<TaxSummary>;
  rectifyStatement: (id: string, input: RectificationInput, key: string) => Promise<TaxSummary>;
  statementPdf: (id: string) => Promise<Blob>;
  statementCsv: (id: string) => Promise<Blob>;
}

const context = createSourceContext<TaxDataSource>('Fiscalité', () => {
  throw new MissingSourceError('Fiscalité');
});

export const TaxSourceProvider = context.SourceProvider;
export const useTaxSource = context.useSource;
