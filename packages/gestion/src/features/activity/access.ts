import { canRead, canWrite } from '../orgapi/permissions';
import type { RoleMatrix } from '../orgapi/model';

export type JournalAccess = 'full' | 'history' | 'none';

export function journalAccess(matrix: RoleMatrix | undefined): JournalAccess {
  if (canRead(matrix, 'activity_detail')) return 'full';
  return canRead(matrix, 'activity_log') ? 'history' : 'none';
}

export const canExportJournal = (matrix: RoleMatrix | undefined): boolean => canWrite(matrix, 'activity_export');
