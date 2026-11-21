'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Page } from '../shared/model';
import type { LeaseNoticeInput, NoticeQuery, NoticeRequest } from './model';

export interface NoticesSource {
  list: (query: NoticeQuery) => Promise<Page<NoticeRequest>>;
  get: (id: string) => Promise<NoticeRequest>;
  acknowledge: (id: string, receivedOn: string) => Promise<NoticeRequest>;
  downloadProof: (id: string) => Promise<Blob>;
  recordLeaseNotice: (leaseId: string, lockVersion: number, requestId: string, input: LeaseNoticeInput) => Promise<void>;
  endParticipant: (leaseId: string, linkId: string, lockVersion: number, requestId: string, validTo: string) => Promise<void>;
}

const context = createSourceContext<NoticesSource>('Demandes de congé', () => {
  throw new MissingSourceError('Demandes de congé');
});

export const NoticesSourceProvider = context.SourceProvider;
export const useNoticesSource = context.useSource;
