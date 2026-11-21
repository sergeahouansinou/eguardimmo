import { OrgApiError } from '../../orgapi/errors';
import type { DuplicateCandidate, ImportFailure } from '../model';
import { toDuplicateCandidates } from './mapping';
import { duplicateCandidates, importDuplicateRows, importInvalidRows } from './schemas';

export const DUPLICATE_CODE = 'party_possible_duplicate';
export const IMPORT_INVALID_CODE = 'party_import_invalid';

export function duplicateCandidatesOf(error: unknown): DuplicateCandidate[] | null {
  if (!(error instanceof OrgApiError) || error.code !== DUPLICATE_CODE) return null;
  const parsed = duplicateCandidates.safeParse(error.extensions);
  return parsed.success ? toDuplicateCandidates(parsed.data.candidates) : null;
}

export function importFailureOf(error: unknown): ImportFailure | null {
  if (!(error instanceof OrgApiError)) return null;
  if (error.code === IMPORT_INVALID_CODE) {
    const parsed = importInvalidRows.safeParse(error.extensions);
    if (!parsed.success) return null;
    return { kind: 'invalid', total: parsed.data.rows_in_error, rows: parsed.data.rows.map((row) => ({ row: row.row, messages: Object.values(row.errors).flat() })) };
  }
  if (error.code === DUPLICATE_CODE) {
    const parsed = importDuplicateRows.safeParse(error.extensions);
    if (!parsed.success) return null;
    return {
      kind: 'duplicates',
      total: parsed.data.rows_in_error,
      rows: parsed.data.rows.map((row) => ({ row: row.row, candidates: toDuplicateCandidates(row.candidates), duplicateOfRows: row.duplicate_of_rows })),
    };
  }
  return null;
}
