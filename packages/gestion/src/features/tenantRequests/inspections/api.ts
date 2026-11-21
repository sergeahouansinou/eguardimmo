import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { id, isoDate, oneOf, pageOf, timestamp } from '../shared/schemas';
import { createTransport } from '../shared/transport';
import { INSPECTION_KINDS, INSPECTION_PERFORMERS, REMARK_ANSWERS, REMARK_KINDS, REMARK_STATUSES } from './model';
import type { Inspection, Remark } from './model';
import type { InspectionsSource } from './source';

export const apiInspectionSchema = z.object({
  id,
  lease_id: id,
  kind: z.enum(INSPECTION_KINDS),
  performed_on: isoDate,
  performed_by: z.enum(INSPECTION_PERFORMERS),
  signatories: z.array(z.object({ name: z.string(), capacity: z.string(), date: isoDate })),
  exit_matches_entry: z.boolean().nullable(),
  stored_file_id: id,
  published_at: timestamp.nullable(),
  published_by_user_id: id.nullable(),
  created_by_user_id: id,
  lock_version: z.number().int().positive(),
  created_at: timestamp,
});

export const apiRemarkSchema = z.object({
  id,
  inspection_id: id,
  party_id: id,
  kind: z.enum(REMARK_KINDS),
  body: z.string(),
  status: z.enum(REMARK_STATUSES),
  answer: z.enum(REMARK_ANSWERS).nullable(),
  answer_body: z.string().nullable(),
  answered_by_user_id: id.nullable(),
  answered_at: timestamp.nullable(),
  photos: z.array(z.object({ id, position: z.number().int().nonnegative() })),
  created_at: timestamp,
});

const apiInspectionPage = pageOf(apiInspectionSchema);
const apiInspectionResponse = oneOf(apiInspectionSchema);
const apiRemarkPage = pageOf(apiRemarkSchema);
const apiRemarkResponse = oneOf(apiRemarkSchema);

export const toInspection = (row: z.infer<typeof apiInspectionSchema>): Inspection => ({
  id: row.id,
  leaseId: row.lease_id,
  kind: row.kind,
  performedOn: row.performed_on,
  performedBy: row.performed_by,
  signatories: row.signatories,
  exitMatchesEntry: row.exit_matches_entry,
  publishedAt: row.published_at,
  lockVersion: row.lock_version,
  createdAt: row.created_at,
});

export const toRemark = (row: z.infer<typeof apiRemarkSchema>): Remark => ({
  id: row.id,
  inspectionId: row.inspection_id,
  partyId: row.party_id,
  kind: row.kind,
  body: row.body,
  status: row.status,
  answer: row.answer,
  answerBody: row.answer_body,
  answeredAt: row.answered_at,
  photos: row.photos,
  createdAt: row.created_at,
});

const PAGE_SIZE = 25;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
const segment = encodeURIComponent;

export interface ApiInspectionsOptions {
  client: ApiClient;
  organizationId: string | null;
  fetchImpl?: typeof fetch;
}

export function createApiInspectionsSource({ client, organizationId, fetchImpl }: ApiInspectionsOptions): InspectionsSource {
  const transport = createTransport(client, organizationId, fetchImpl);
  return {
    list: async (leaseId, cursor) => {
      const page = await transport.get(`/leases/${segment(leaseId)}/inspections`, apiInspectionPage, { per_page: PAGE_SIZE, cursor });
      return { items: page.data.map(toInspection), nextCursor: page.meta.next_cursor };
    },
    get: async (inspectionId) => toInspection((await transport.get(`/inspections/${segment(inspectionId)}`, apiInspectionResponse)).data),
    create: async (leaseId, input) => {
      const body = new FormData();
      body.set('file', input.file);
      body.set('kind', input.kind);
      body.set('performed_on', input.performedOn);
      body.set('performed_by', input.performedBy);
      body.set('client_id', input.clientId);
      if (input.exitMatchesEntry !== null) body.set('exit_matches_entry', input.exitMatchesEntry ? '1' : '0');
      input.signatories.forEach((signatory, index) => {
        body.set(`signatories[${String(index)}][name]`, signatory.name);
        body.set(`signatories[${String(index)}][capacity]`, signatory.capacity);
        body.set(`signatories[${String(index)}][date]`, signatory.date);
      });
      return toInspection((await transport.post(`/leases/${segment(leaseId)}/inspections`, apiInspectionResponse, body)).data);
    },
    update: async (inspectionId, lockVersion, changes) =>
      toInspection((await transport.patch(`/inspections/${segment(inspectionId)}`, apiInspectionResponse, {
        lock_version: lockVersion,
        performed_on: changes.performedOn,
        performed_by: changes.performedBy,
        exit_matches_entry: changes.exitMatchesEntry,
        signatories: changes.signatories,
      })).data),
    publish: async (inspectionId) => toInspection((await transport.post(`/inspections/${segment(inspectionId)}/publish`, apiInspectionResponse)).data),
    downloadDocument: (inspectionId) => transport.blob(`/inspections/${segment(inspectionId)}/document`, ['application/pdf']),
    remarks: async (inspectionId, cursor) => {
      const page = await transport.get(`/inspections/${segment(inspectionId)}/remarks`, apiRemarkPage, { per_page: PAGE_SIZE, cursor });
      return { items: page.data.map(toRemark), nextCursor: page.meta.next_cursor };
    },
    answer: async (remarkId, answer, body) => toRemark((await transport.post(`/inspection-remarks/${segment(remarkId)}/answer`, apiRemarkResponse, { answer, body })).data),
    downloadPhoto: (fileId) => transport.blob(`/inspection-remark-files/${segment(fileId)}`, PHOTO_TYPES),
  };
}
