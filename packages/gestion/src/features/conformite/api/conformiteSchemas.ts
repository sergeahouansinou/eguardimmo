import { z } from 'zod';
import { CERTIFICATE_STATES, SUBJECT_TYPES, VALUE_KINDS } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const pageMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const apiCertificateSchema = z.object({
  id,
  subject: z.object({ type: z.enum(SUBJECT_TYPES), id }),
  type: z.object({ id, key: z.string(), label: z.string(), semantic_key: z.string().nullable() }),
  reference: z.string().nullable(),
  issuer_party_id: id.nullable(),
  issued_on: isoDate,
  expires_on: isoDate.nullable(),
  state: z.enum(CERTIFICATE_STATES),
  values: z.record(z.string(), z.unknown()),
  stored_file_id: id.nullable(),
  replaces_id: id.nullable(),
  replaced_by_id: id.nullable(),
});

export const apiFileSchema = z.object({
  id,
  name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  sha256: z.string(),
  category: z.string(),
  subject: z.object({ type: z.enum(SUBJECT_TYPES), id }).nullable(),
  retention_until: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

const fieldSchema = z.object({
  type: z.enum(VALUE_KINDS),
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const apiTermSchema = z.object({
  id,
  key: z.string(),
  labels: z.record(z.string(), z.string()),
  semantic_key: z.string().nullable(),
  archived: z.boolean(),
  hidden: z.boolean(),
  metadata: z.object({
    default_validity_months: z.number().int().nonnegative().optional(),
    reminder_days: z.number().int().nonnegative().optional(),
    data_schema: z.record(z.string(), fieldSchema).optional(),
  }),
});

export const apiCertificateResponse = z.object({ data: apiCertificateSchema });
export const apiCertificatePage = z.object({ data: z.array(apiCertificateSchema), meta: pageMeta });
export const apiFileResponse = z.object({ data: apiFileSchema });
export const apiTermsResponse = z.object({ data: z.array(z.unknown()) });

export type ApiCertificate = z.infer<typeof apiCertificateSchema>;
export type ApiTerm = z.infer<typeof apiTermSchema>;
