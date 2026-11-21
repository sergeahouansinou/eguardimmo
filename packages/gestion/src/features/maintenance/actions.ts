import type { InterventionDetail, InterventionStatus, MaintenancePermissions } from './model';
import { isTerminal } from './labels';

const within = (status: InterventionStatus, allowed: readonly InterventionStatus[]): boolean => allowed.includes(status);

export interface InterventionActions {
  qualify: boolean;
  decline: boolean;
  cancel: boolean;
  assign: boolean;
  engage: boolean;
  addQuote: boolean;
  addVisit: boolean;
  complete: boolean;
  close: boolean;
  reopen: boolean;
  comment: boolean;
  addFile: boolean;
  recordInvoice: boolean;
}

export function interventionActions(intervention: InterventionDetail, permissions: MaintenancePermissions): InterventionActions {
  const { status } = intervention;
  const writable = permissions.write && !isTerminal(status);
  return {
    qualify: writable && status === 'reported',
    decline: writable && within(status, ['reported', 'qualified']),
    cancel: writable && !within(status, ['completed', 'invoiced']),
    assign: writable && within(status, ['qualified', 'quoting', 'awaiting_approval', 'approved']),
    engage: writable && within(status, ['qualified', 'quoting', 'awaiting_approval']),
    addQuote: writable && within(status, ['qualified', 'quoting', 'awaiting_approval']) && intervention.supplier !== null,
    addVisit: writable && within(status, ['approved', 'scheduled', 'in_progress']),
    complete: writable && within(status, ['scheduled', 'in_progress']),
    close: permissions.write && within(status, ['completed', 'invoiced']),
    reopen: permissions.write && status === 'completed',
    comment: permissions.write && !isTerminal(status),
    addFile: permissions.write && !isTerminal(status),
    recordInvoice: permissions.finance && within(status, ['in_progress', 'completed', 'invoiced']),
  };
}
