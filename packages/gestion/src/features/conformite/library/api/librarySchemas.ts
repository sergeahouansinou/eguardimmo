import { z } from 'zod';
import { LIBRARY_KINDS, LIBRARY_SUBJECT_TYPES, SCAN_STATUSES } from '../model';

const id = z.guid();
const instant = z.iso.datetime({ offset: true });

export const apiLibraryEntrySchema = z.object({
  id,
  kind: z.enum(LIBRARY_KINDS),
  archived_at: instant.nullable(),
  filed_by_user_id: id.nullable(),
  lock_version: z.number().int().positive(),
  created_at: instant,
  file: z.object({
    id,
    name: z.string(),
    mime_type: z.string(),
    size_bytes: z.number().int().nonnegative(),
    scan_status: z.enum(SCAN_STATUSES),
    subject: z.object({ type: z.enum(LIBRARY_SUBJECT_TYPES), id }).nullable(),
    retention_until: instant.nullable(),
  }),
});

export const apiLibraryEntryResponse = z.object({ data: apiLibraryEntrySchema });
export const apiLibraryPage = z.object({
  data: z.array(apiLibraryEntrySchema),
  meta: z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() }),
});
