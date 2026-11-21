import { z } from 'zod';
import { oneOf, pageOf, timestamp } from './apiKit';

const leaseDocument = z
  .object({
    id: z.uuid(),
    kind: z.string(),
    shared_at: timestamp.nullable(),
    file: z.object({ name: z.string(), mime_type: z.string(), size_bytes: z.number().int().nonnegative() }).nullable(),
  })
  .transform((item) => ({
    id: item.id,
    kind: item.kind,
    sharedAt: item.shared_at,
    file: item.file === null ? null : { name: item.file.name, mimeType: item.file.mime_type, sizeBytes: item.file.size_bytes },
  }));

export type LeaseDocument = z.output<typeof leaseDocument>;
export const leaseDocumentPageSchema = pageOf(leaseDocument);
export const leaseDocumentSchema = oneOf(leaseDocument);
