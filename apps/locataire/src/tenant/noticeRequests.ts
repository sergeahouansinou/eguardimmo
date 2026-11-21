import type { ApiClient } from '@eguardimmo/api';
import { fetchBlob } from './blobRequests';
import { noticeOptionsSchema, noticeRequestPageSchema, noticeRequestSchema } from './noticeSchemas';
import type { NoticeOptions, NoticeRequest } from './noticeSchemas';
import type { CursorPage } from './rentModel';
import { parse } from './requests';

const segment = encodeURIComponent;
const BASE = '/api/v1/tenant';

export interface NoticeInput {
  leaseId: string;
  reasonKey: string;
  departureOn: string;
  forwardingAddress: string;
  consentVersion: string;
  proof: File | null;
  clientId: string;
}

export async function fetchNoticeOptions(client: ApiClient, leaseId: string): Promise<NoticeOptions> {
  return parse(noticeOptionsSchema, await client.get(`${BASE}/leases/${segment(leaseId)}/notice-options`)).data;
}

export async function fetchNoticeRequestsPage(client: ApiClient, cursor: string | null): Promise<CursorPage<NoticeRequest>> {
  const page = parse(noticeRequestPageSchema, await client.get(`${BASE}/notice-requests`, { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function submitNotice(client: ApiClient, input: NoticeInput): Promise<NoticeRequest> {
  const form = new FormData();
  form.append('reason_key', input.reasonKey);
  form.append('requested_departure_on', input.departureOn);
  if (input.forwardingAddress.trim() !== '') form.append('forwarding_address', input.forwardingAddress.trim());
  form.append('consent_accepted', '1');
  form.append('consent_version', input.consentVersion);
  form.append('client_id', input.clientId);
  if (input.proof !== null) form.append('proof', input.proof);
  return parse(noticeRequestSchema, await client.post(`${BASE}/leases/${segment(input.leaseId)}/notice-requests`, form)).data;
}

export async function withdrawNotice(client: ApiClient, id: string): Promise<NoticeRequest> {
  return parse(noticeRequestSchema, await client.delete(`${BASE}/notice-requests/${segment(id)}`)).data;
}

export const noticeLetterPath = (id: string): string => `${BASE}/notice-requests/${segment(id)}/letter`;

export function fetchLetter(client: ApiClient, path: string, fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, ['application/pdf'], fetchImpl);
}
