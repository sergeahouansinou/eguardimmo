import type { BadgeTone } from '@eguardimmo/ui';
import type { LibraryKind, LibrarySubjectType, ScanStatus } from './model';

export const libraryKindLabel: Record<LibraryKind, string> = {
  mandate: 'Mandat',
  lease: 'Bail',
  diagnostic: 'Diagnostic',
  photo: 'Photo',
  other: 'Autre',
};

export const librarySubjectLabel: Record<LibrarySubjectType, string> = {
  organization: 'Agence',
  unit: 'Lot',
  party: 'Tiers',
  equipment: 'Équipement',
  lease: 'Bail',
  mandate: 'Mandat',
};

export const scanBadge: Record<ScanStatus, { label: string; tone: BadgeTone; hint: string | null }> = {
  clean: { label: 'Analysé, sain', tone: 'success', hint: null },
  pending: { label: 'Analyse en cours', tone: 'info', hint: 'L’analyse antivirus n’est pas terminée : le fichier sera disponible dans quelques instants.' },
  unverifiable: { label: 'Analyse impossible', tone: 'warning', hint: 'L’analyse antivirus n’a pas pu aboutir pour l’instant : elle est relancée automatiquement.' },
  infected: { label: 'Fichier non sain', tone: 'danger', hint: 'Ce fichier est non sain : il est bloqué et ne peut être ni téléchargé ni partagé.' },
};

export const isReadable = (status: ScanStatus): boolean => status === 'clean';

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${String(bytes)} o`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
};
