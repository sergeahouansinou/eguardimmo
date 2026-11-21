import type { ApiClient } from '@eguardimmo/api';
import { fetchBlob } from './blobRequests';
import { inspectionPageSchema, inspectionSchema, remarkPageSchema, remarkSchema } from './inspectionSchemas';
import type { Inspection, InspectionRemark, RemarkKind } from './inspectionSchemas';
import type { CursorPage } from './rentModel';
import { parse } from './requests';

const segment = encodeURIComponent;
const BASE = '/api/v1/tenant/inspections';

export interface RemarkInput {
  inspectionId: string;
  kind: RemarkKind;
  body: string;
  photos: readonly File[];
  clientId: string;
}

export async function fetchInspectionsPage(client: ApiClient, cursor: string | null): Promise<CursorPage<Inspection>> {
  const page = parse(inspectionPageSchema, await client.get(BASE, { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function fetchInspection(client: ApiClient, id: string): Promise<Inspection> {
  return parse(inspectionSchema, await client.get(`${BASE}/${segment(id)}`)).data;
}

export async function fetchRemarksPage(client: ApiClient, id: string, cursor: string | null): Promise<CursorPage<InspectionRemark>> {
  const page = parse(remarkPageSchema, await client.get(`${BASE}/${segment(id)}/remarks`, { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function createRemark(client: ApiClient, input: RemarkInput): Promise<InspectionRemark> {
  const form = new FormData();
  form.append('kind', input.kind);
  form.append('body', input.body.trim());
  form.append('client_id', input.clientId);
  for (const photo of input.photos) form.append('photos[]', photo);
  return parse(remarkSchema, await client.post(`${BASE}/${segment(input.inspectionId)}/remarks`, form)).data;
}

export const inspectionDocumentPath = (id: string): string => `${BASE}/${segment(id)}/document`;
export const inspectionFilePath = (fileId: string): string => `/api/v1/tenant/inspection-files/${segment(fileId)}`;

export function fetchInspectionBlob(client: ApiClient, path: string, accepted: readonly string[], fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, accepted, fetchImpl);
}
