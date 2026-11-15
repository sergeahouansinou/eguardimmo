import type { Lease } from './schemas';

export function findOverlap(all: readonly Lease[], fields: Pick<Lease, 'unitId' | 'start' | 'end' | 'status'>, selfId?: string): Lease | undefined {
  if (fields.status === 'brouillon') return undefined;
  return all.find(
    (other) => other.id !== selfId && other.unitId === fields.unitId && (other.status === 'en_cours' || other.status === 'preavis' || other.status === 'a_venir') && other.end >= fields.start && other.start <= fields.end,
  );
}

export const isRunningLease = (lease: Pick<Lease, 'status' | 'archived'>): boolean => !lease.archived && (lease.status === 'en_cours' || lease.status === 'preavis');

export const isArchivable = (lease: Pick<Lease, 'status'>): boolean => lease.status === 'termine' || lease.status === 'brouillon';

export type StagedLease = Pick<Lease, 'unitId' | 'start' | 'end'>;

export interface ImportClash {
  start: string;
  end: string;
  reference: string | null;
}

export function findImportClash(existing: readonly Lease[], staged: readonly StagedLease[], fields: Pick<Lease, 'unitId' | 'start' | 'end' | 'status'>): ImportClash | undefined {
  const lease = findOverlap(existing, fields);
  if (lease) return { start: lease.start, end: lease.end, reference: lease.reference };
  const batch = staged.find((other) => other.unitId === fields.unitId && other.end >= fields.start && other.start <= fields.end);
  return batch ? { start: batch.start, end: batch.end, reference: null } : undefined;
}
