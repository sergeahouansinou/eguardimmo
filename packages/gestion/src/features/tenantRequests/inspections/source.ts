'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Page } from '../shared/model';
import type { Inspection, InspectionChanges, InspectionInput, Remark, RemarkAnswer } from './model';

export interface InspectionsSource {
  list: (leaseId: string, cursor: string | null) => Promise<Page<Inspection>>;
  get: (id: string) => Promise<Inspection>;
  create: (leaseId: string, input: InspectionInput) => Promise<Inspection>;
  update: (id: string, lockVersion: number, changes: InspectionChanges) => Promise<Inspection>;
  publish: (id: string) => Promise<Inspection>;
  downloadDocument: (id: string) => Promise<Blob>;
  remarks: (id: string, cursor: string | null) => Promise<Page<Remark>>;
  answer: (remarkId: string, answer: RemarkAnswer, body: string) => Promise<Remark>;
  downloadPhoto: (fileId: string) => Promise<Blob>;
}

const context = createSourceContext<InspectionsSource>('États des lieux', () => {
  throw new MissingSourceError('États des lieux');
});

export const InspectionsSourceProvider = context.SourceProvider;
export const useInspectionsSource = context.useSource;
