import type { ApiClient } from '@eguardimmo/api';
import { fetchBlob } from './blobRequests';
import type { LeaseDocument } from './documentSchemas';
import { leaseDocumentPageSchema } from './documentSchemas';
import { parse } from './requests';
import type { CursorPage } from './rentModel';

const segment = encodeURIComponent;

export const DOCUMENT_MIME_PREFIXES = ['application/pdf', 'image/', 'application/vnd.', 'application/msword', 'application/octet-stream', 'text/plain'] as const;

export async function fetchLeaseDocumentsPage(client: ApiClient, leaseId: string, cursor: string | null): Promise<CursorPage<LeaseDocument>> {
  const page = parse(leaseDocumentPageSchema, await client.get(`/api/v1/tenant/leases/${segment(leaseId)}/documents`, { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export const leaseDocumentPath = (leaseId: string, documentId: string): string =>
  `/api/v1/tenant/leases/${segment(leaseId)}/documents/${segment(documentId)}/download`;

export function fetchDocumentFile(client: ApiClient, path: string, fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, DOCUMENT_MIME_PREFIXES, fetchImpl);
}
