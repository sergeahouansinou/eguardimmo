export const LIBRARY_KINDS = ['mandate', 'lease', 'diagnostic', 'photo', 'other'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const SCAN_STATUSES = ['pending', 'clean', 'infected', 'unverifiable'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const LIBRARY_SUBJECT_TYPES = ['organization', 'unit', 'party', 'equipment', 'lease', 'mandate'] as const;
export type LibrarySubjectType = (typeof LIBRARY_SUBJECT_TYPES)[number];

export interface LibrarySubject {
  type: LibrarySubjectType;
  id: string;
}

export interface LibraryFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: ScanStatus;
  subject: LibrarySubject | null;
  retentionUntil: string | null;
}

export interface LibraryEntry {
  id: string;
  kind: LibraryKind;
  archived: boolean;
  filedByUserId: string | null;
  lockVersion: number;
  createdAt: string;
  file: LibraryFile;
}

export interface LibraryQuery {
  kind: LibraryKind | null;
  archived: boolean;
}

export interface LibraryPage {
  items: LibraryEntry[];
  nextCursor: string | null;
}

export interface NewLibraryDocument {
  file: File;
  kind: LibraryKind;
  subject: LibrarySubject | null;
  displayName: string;
  retentionUntil: string;
}

export interface LibraryPermissions {
  write: boolean;
}
