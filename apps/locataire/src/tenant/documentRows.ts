import { pdfFilename, safeFileName } from './download';
import { leaseDocumentPath } from './documentRequests';
import type { LeaseDocument } from './documentSchemas';
import { inspectionDocumentPath } from './inspectionRequests';
import type { Inspection } from './inspectionSchemas';
import { INSPECTION_KIND_LABEL } from './inspectionLabels';
import { SUBMISSION_VIEW } from './insuranceLabels';
import { submissionFilePath } from './insuranceRequests';
import type { InsuranceSubmission } from './insuranceSchemas';
import type { Receipt } from './rentModel';
import { receiptPdfPath } from './rentRequests';

export const DOCUMENT_GROUPS = ['bail', 'quittances', 'etats', 'assurance'] as const;
export type DocumentGroup = (typeof DOCUMENT_GROUPS)[number];

export const GROUP_LABEL: Record<DocumentGroup, string> = {
  bail: 'Bail et pièces partagées',
  quittances: 'Quittances',
  etats: 'États des lieux',
  assurance: 'Assurance',
};

export interface DocumentRow {
  key: string;
  group: DocumentGroup;
  name: string;
  detail: string;
  date: string | null;
  sizeBytes: number | null;
  file: { path: string; filename: string } | null;
  href: string | null;
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  signed_lease: 'Bail signé',
  amendment: 'Avenant',
  diagnostic: 'Diagnostic',
  letter: 'Courrier',
  attestation: 'Attestation',
  other: 'Autre document',
};

export const documentKindLabel = (kind: string): string => KIND_LABEL[kind] ?? KIND_LABEL.other ?? 'Autre document';

export function leaseDocumentRow(leaseId: string, item: LeaseDocument): DocumentRow {
  const kind = documentKindLabel(item.kind);
  return {
    key: `bail-${item.id}`,
    group: 'bail',
    name: item.file?.name ?? kind,
    detail: item.file === null ? `${kind} · fichier indisponible` : kind,
    date: item.sharedAt,
    sizeBytes: item.file?.sizeBytes ?? null,
    file: item.file === null ? null : { path: leaseDocumentPath(leaseId, item.id), filename: safeFileName(item.file.name) },
    href: null,
  };
}

export function receiptRow(receipt: Receipt): DocumentRow {
  return {
    key: `quittance-${receipt.id}`,
    group: 'quittances',
    name: `Quittance ${receipt.number}`,
    detail: receipt.isVoid ? 'Quittance annulée' : 'Quittance de loyer',
    date: receipt.issuedOn,
    sizeBytes: null,
    file: receipt.isVoid ? null : { path: receiptPdfPath(receipt.id), filename: pdfFilename(`Quittance-${receipt.number}`) },
    href: `/loyers/quittances/${receipt.id}`,
  };
}

export function inspectionRow(inspection: Inspection): DocumentRow {
  const name = INSPECTION_KIND_LABEL[inspection.kind];
  return {
    key: `etat-${inspection.id}`,
    group: 'etats',
    name,
    detail: 'Document figé après publication',
    date: inspection.performedOn,
    sizeBytes: null,
    file: { path: inspectionDocumentPath(inspection.id), filename: pdfFilename(`${name}-${inspection.performedOn}`) },
    href: `/etats-des-lieux/${inspection.id}`,
  };
}

export function submissionRow(item: InsuranceSubmission): DocumentRow {
  return {
    key: `assurance-${item.id}`,
    group: 'assurance',
    name: `Attestation ${item.insurer}`,
    detail: `Attestation déposée · ${SUBMISSION_VIEW[item.status].label}`,
    date: item.createdAt,
    sizeBytes: null,
    file: { path: submissionFilePath(item.id), filename: safeFileName(`Attestation-${item.insurer}-${item.startsOn}`) },
    href: '/assurance',
  };
}

export const sortByDate = (rows: readonly DocumentRow[]): DocumentRow[] => [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
