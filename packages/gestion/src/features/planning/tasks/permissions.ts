'use client';

import { useOrgInfoSource, useOrgPermission } from '../../orgapi';

export interface TaskPermissions {
  pending: boolean;
  write: boolean;
  progress: boolean;
  reopenCancelled: boolean;
}

const PRIVILEGED_ROLES = ['owner', 'admin', 'manager'];

export function useTaskPermissions(): TaskPermissions {
  const info = useOrgInfoSource();
  const planning = useOrgPermission('planning');
  const progress = useOrgPermission('planning_task_progress');
  return { pending: planning.pending, write: planning.write, progress: progress.write, reopenCancelled: info.role !== null && PRIVILEGED_ROLES.includes(info.role) };
}
