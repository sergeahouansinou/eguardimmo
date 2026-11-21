import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { invalidInput } from '../shared/errors';
import { id, isoDate, oneOf, pageOf, timestamp } from '../shared/schemas';
import { createTransport } from '../shared/transport';
import { NOTICE_OUTCOMES, NOTICE_STATUSES } from './model';
import type { NoticeRequest } from './model';
import type { NoticesSource } from './source';

export const apiNoticeSchema = z.object({
  id,
  lease_id: id,
  party_id: id,
  status: z.enum(NOTICE_STATUSES),
  reason_key: z.string(),
  requested_departure_on: isoDate,
  earliest_departure_on: isoDate,
  received_on: isoDate.nullable(),
  has_proof: z.boolean(),
  letter_document_id: id.nullable(),
  letter_file_id: id.nullable(),
  letter_fingerprint: z.string().nullable(),
  forwarding_address: z.string().nullable(),
  consent_version: z.string(),
  acknowledged_by_user_id: id.nullable(),
  acknowledged_at: timestamp.nullable(),
  withdrawn_at: timestamp.nullable(),
  closed_outcome: z.enum(NOTICE_OUTCOMES).nullable(),
  closed_at: timestamp.nullable(),
  late_flagged_at: timestamp.nullable(),
  created_at: timestamp,
});

const apiNoticePage = pageOf(apiNoticeSchema);
const apiNoticeResponse = oneOf(apiNoticeSchema);
const apiLeaseResponse = z.object({ data: z.object({ id }) });

export const toNotice = (row: z.infer<typeof apiNoticeSchema>): NoticeRequest => ({
  id: row.id,
  leaseId: row.lease_id,
  partyId: row.party_id,
  status: row.status,
  reasonKey: row.reason_key,
  requestedDepartureOn: row.requested_departure_on,
  earliestDepartureOn: row.earliest_departure_on,
  receivedOn: row.received_on,
  hasProof: row.has_proof,
  letterDocumentId: row.letter_document_id,
  letterFingerprint: row.letter_fingerprint,
  forwardingAddress: row.forwarding_address,
  consentVersion: row.consent_version,
  acknowledgedAt: row.acknowledged_at,
  withdrawnAt: row.withdrawn_at,
  closedOutcome: row.closed_outcome,
  closedAt: row.closed_at,
  lateFlaggedAt: row.late_flagged_at,
  createdAt: row.created_at,
});

const PAGE_SIZE = 25;
const SCAN_PAGE_SIZE = 100;
const MAX_SCAN_PAGES = 10;
const segment = encodeURIComponent;

export interface ApiNoticesOptions {
  client: ApiClient;
  organizationId: string | null;
  fetchImpl?: typeof fetch;
}

export function createApiNoticesSource({ client, organizationId, fetchImpl }: ApiNoticesOptions): NoticesSource {
  const transport = createTransport(client, organizationId, fetchImpl);

  const scanLease = async (leaseId: string, status: string | undefined) => {
    const found: NoticeRequest[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
      const result: z.infer<typeof apiNoticePage> = await transport.get('/notice-requests', apiNoticePage, { per_page: SCAN_PAGE_SIZE, cursor, status });
      found.push(...result.data.filter((row) => row.lease_id === leaseId).map(toNotice));
      cursor = result.meta.next_cursor;
      if (cursor === null) break;
    }
    return { items: found, nextCursor: null };
  };

  return {
    list: async (query) => {
      if (query.leaseId !== null) return scanLease(query.leaseId, query.status ?? undefined);
      const page = await transport.get('/notice-requests', apiNoticePage, { per_page: PAGE_SIZE, cursor: query.cursor, status: query.status ?? undefined });
      return { items: page.data.map(toNotice), nextCursor: page.meta.next_cursor };
    },
    get: async (noticeId) => toNotice((await transport.get(`/notice-requests/${segment(noticeId)}`, apiNoticeResponse)).data),
    acknowledge: async (noticeId, receivedOn) => toNotice((await transport.post(`/notice-requests/${segment(noticeId)}/acknowledge`, apiNoticeResponse, { received_on: receivedOn })).data),
    downloadProof: (noticeId) => transport.blob(`/notice-requests/${segment(noticeId)}/proof`, ['application/pdf', 'image/jpeg', 'image/png']),
    recordLeaseNotice: async (leaseId, lockVersion, requestId, input) => {
      if (input.reason.trim() === '') throw invalidInput('Indiquez le motif du congé.');
      await transport.post(`/leases/${segment(leaseId)}/notice`, apiLeaseResponse, {
        lock_version: lockVersion,
        notice_given_by: 'tenant',
        notice_received_on: input.receivedOn,
        ...(input.departureOn === null ? {} : { notice_departure_on: input.departureOn }),
        termination_reason: input.reason.trim(),
        replace: input.replace,
        notice_request_id: requestId,
      });
    },
    endParticipant: async (leaseId, linkId, lockVersion, requestId, validTo) => {
      await transport.post(`/leases/${segment(leaseId)}/parties/${segment(linkId)}/end`, apiLeaseResponse, {
        lock_version: lockVersion,
        valid_to: validTo,
        notice_request_id: requestId,
      });
    },
  };
}
