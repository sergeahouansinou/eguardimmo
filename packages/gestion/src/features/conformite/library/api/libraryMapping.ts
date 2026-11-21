import type { LibraryEntry } from '../model';
import type { z } from 'zod';
import type { apiLibraryEntrySchema } from './librarySchemas';

export function toLibraryEntry(entry: z.infer<typeof apiLibraryEntrySchema>): LibraryEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    archived: entry.archived_at !== null,
    filedByUserId: entry.filed_by_user_id,
    lockVersion: entry.lock_version,
    createdAt: entry.created_at,
    file: {
      id: entry.file.id,
      name: entry.file.name,
      mimeType: entry.file.mime_type,
      sizeBytes: entry.file.size_bytes,
      scanStatus: entry.file.scan_status,
      subject: entry.file.subject,
      retentionUntil: entry.file.retention_until,
    },
  };
}
