import type { ReportingPermissions } from './model';

export type ReportingRole = 'owner' | 'admin' | 'manager' | 'accountant';
export type ReportingOrganizationKind = 'agency' | 'individual';

const NONE: ReportingPermissions = { cards: false, agency: false, publish: false, export: false };

export function reportingPermissions(role: ReportingRole | null, kind: ReportingOrganizationKind | null): ReportingPermissions {
  if (role === null || kind === null) return NONE;
  const agency = kind === 'agency';
  return {
    cards: true,
    agency,
    publish: agency && role !== 'accountant',
    export: agency && role !== 'manager',
  };
}
