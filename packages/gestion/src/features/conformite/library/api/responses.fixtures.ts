export const IDS = {
  org: '01a1e9ab-9bb6-73d1-aada-8d70cacbaaaf',
  user: '01a1e9ab-9bb7-7000-8000-000000000301',
  mandate: '01a1e9ab-9bb8-7000-8000-000000000401',
  lease: '01a1e9ab-9bb8-7000-8000-000000000131',
  mandateEntry: '01a1e9ab-9bc0-7000-8000-000000000501',
  diagnosticEntry: '01a1e9ab-9bc1-7000-8000-000000000502',
  photoEntry: '01a1e9ab-9bc2-7000-8000-000000000503',
  archivedEntry: '01a1e9ab-9bc3-7000-8000-000000000504',
  mandateFile: '01a1e9ab-9bd0-7000-8000-000000000601',
  diagnosticFile: '01a1e9ab-9bd1-7000-8000-000000000602',
  photoFile: '01a1e9ab-9bd2-7000-8000-000000000603',
  archivedFile: '01a1e9ab-9bd3-7000-8000-000000000604',
} as const;

const NEXT_CURSOR = 'eyJpZCI6IjAxYTFlOWFiLTliYzEtNzAwMC04MDAwLTAwMDAwMDAwMDUwMiIsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0';

type ScanStatus = 'pending' | 'clean' | 'infected' | 'unverifiable';

interface EntryOverrides {
  id: string;
  fileId: string;
  kind: 'mandate' | 'lease' | 'diagnostic' | 'photo' | 'other';
  name: string;
  scan: ScanStatus;
  subject: { type: string; id: string } | null;
  archivedAt?: string | null;
  mimeType?: string;
  size?: number;
  lockVersion?: number;
  retentionUntil?: string | null;
}

export function entry({ id, fileId, kind, name, scan, subject, archivedAt = null, mimeType = 'application/pdf', size = 48_213, lockVersion = 1, retentionUntil = null }: EntryOverrides) {
  return {
    id,
    kind,
    archived_at: archivedAt,
    filed_by_user_id: IDS.user,
    lock_version: lockVersion,
    created_at: '2026-11-18T09:30:00+00:00',
    file: { id: fileId, name, mime_type: mimeType, size_bytes: size, scan_status: scan, subject, retention_until: retentionUntil },
  };
}

export const mandateEntry = entry({ id: IDS.mandateEntry, fileId: IDS.mandateFile, kind: 'mandate', name: 'Mandat de gestion M-2026-0012.pdf', scan: 'clean', subject: { type: 'mandate', id: IDS.mandate }, retentionUntil: '2036-11-18T23:59:59+00:00' });
export const diagnosticPending = entry({ id: IDS.diagnosticEntry, fileId: IDS.diagnosticFile, kind: 'diagnostic', name: 'Diagnostic gaz.pdf', scan: 'pending', subject: null });
export const photoInfected = entry({ id: IDS.photoEntry, fileId: IDS.photoFile, kind: 'photo', name: 'Façade.jpg', scan: 'infected', subject: { type: 'organization', id: IDS.org }, mimeType: 'image/jpeg', size: 2_400_000 });
export const archivedEntry = entry({ id: IDS.archivedEntry, fileId: IDS.archivedFile, kind: 'other', name: 'Ancien règlement.pdf', scan: 'clean', subject: null, archivedAt: '2026-11-19T10:00:00+00:00', lockVersion: 2 });

export const page = (data: unknown[], nextCursor: string | null = null) => ({
  data,
  links: { first: null, last: null, prev: null, next: nextCursor === null ? null : `https://api.eguardimmo.test/api/v1/org/${IDS.org}/documents/library?cursor=${nextCursor}` },
  meta: { path: `https://api.eguardimmo.test/api/v1/org/${IDS.org}/documents/library`, per_page: 25, next_cursor: nextCursor, prev_cursor: null },
});

export const libraryPage = page([mandateEntry, diagnosticPending, photoInfected]);
export const libraryEmpty = page([]);
export const libraryFirstPage = page([mandateEntry, diagnosticPending], NEXT_CURSOR);
export const librarySecondPage = page([photoInfected]);
export const archivedPage = page([archivedEntry]);
export { NEXT_CURSOR };

export const problem = (status: number, code: string, title: string, detail: string, extra: Record<string, unknown> = {}) => ({
  type: `https://api.eguardimmo.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  request_id: '01a1e9ab-9c10-7000-8000-000000000999',
  ...extra,
});

export const problemNotFound = problem(404, 'library_document_not_found', 'Document introuvable', 'Ce document n\'existe pas dans la bibliothèque de votre organisation.');
export const problemMismatch = problem(422, 'library_kind_subject_mismatch', 'Nature et objet incohérents', 'Cette nature de document impose un objet précis : un mandat pour un mandat, un bail pour un bail.');
export const problemNotClean = problem(409, 'document_not_clean', 'Fichier non analysé', 'Ce fichier n\'a pas fini son analyse antivirale ou n\'est pas sain : il ne peut pas être partagé ni utilisé comme preuve.');
export const problemForbidden = problem(403, 'forbidden', 'Accès refusé', 'Votre rôle ne permet pas cette action.');
export const problemFileRefused = problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { file: ['Ce fichier contient du code exécutable.'] } });
export const problemRetention = problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { retention_until: ['validation.after'] } });
