import type { BadgeTone } from '@eguardimmo/ui';

export const INSPECTION_KINDS = ['entry', 'exit'] as const;
export type InspectionKind = (typeof INSPECTION_KINDS)[number];

export const INSPECTION_PERFORMERS = ['parties', 'agent', 'bailiff'] as const;
export type InspectionPerformer = (typeof INSPECTION_PERFORMERS)[number];

export const REMARK_KINDS = ['complement', 'heating', 'comment'] as const;
export type RemarkKind = (typeof REMARK_KINDS)[number];

export const REMARK_STATUSES = ['open', 'answered'] as const;
export type RemarkStatus = (typeof REMARK_STATUSES)[number];

export const REMARK_ANSWERS = ['accepted', 'refused', 'noted'] as const;
export type RemarkAnswer = (typeof REMARK_ANSWERS)[number];

export const MAX_SIGNATORIES = 10;

export interface Signatory {
  name: string;
  capacity: string;
  date: string;
}

export interface Inspection {
  id: string;
  leaseId: string;
  kind: InspectionKind;
  performedOn: string;
  performedBy: InspectionPerformer;
  signatories: Signatory[];
  exitMatchesEntry: boolean | null;
  publishedAt: string | null;
  lockVersion: number;
  createdAt: string;
}

export interface InspectionInput {
  kind: InspectionKind;
  performedOn: string;
  performedBy: InspectionPerformer;
  exitMatchesEntry: boolean | null;
  signatories: Signatory[];
  file: File;
  clientId: string;
}

export interface InspectionChanges {
  performedOn: string;
  performedBy: InspectionPerformer;
  exitMatchesEntry: boolean | null;
  signatories: Signatory[];
}

export interface RemarkPhoto {
  id: string;
  position: number;
}

export interface Remark {
  id: string;
  inspectionId: string;
  partyId: string;
  kind: RemarkKind;
  body: string;
  status: RemarkStatus;
  answer: RemarkAnswer | null;
  answerBody: string | null;
  answeredAt: string | null;
  photos: RemarkPhoto[];
  createdAt: string;
}

export const isPublished = (inspection: Inspection): boolean => inspection.publishedAt !== null;

export const kindLabel: Record<InspectionKind, string> = { entry: 'État des lieux d’entrée', exit: 'État des lieux de sortie' };
export const kindShort: Record<InspectionKind, string> = { entry: 'Entrée', exit: 'Sortie' };

export const performerLabel: Record<InspectionPerformer, string> = {
  parties: 'Les parties entre elles',
  agent: 'L’agence',
  bailiff: 'Un commissaire de justice',
};

export const publicationBadge = (inspection: Inspection): { label: string; tone: BadgeTone } =>
  isPublished(inspection) ? { label: 'Publié', tone: 'success' } : { label: 'Brouillon', tone: 'warning' };

export const conformityLabel = (value: boolean | null): string => {
  if (value === null) return 'Non renseignée';
  return value ? 'Conforme à l’état d’entrée' : 'Différences avec l’état d’entrée';
};

export const remarkKindLabel: Record<RemarkKind, string> = {
  complement: 'Demande de complément',
  heating: 'Chauffage',
  comment: 'Commentaire',
};

export const remarkStatusBadge: Record<RemarkStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'À traiter', tone: 'warning' },
  answered: { label: 'Répondue', tone: 'success' },
};

export const answerLabel: Record<RemarkAnswer, string> = {
  accepted: 'Demande acceptée',
  refused: 'Demande refusée',
  noted: 'Prise en note',
};
