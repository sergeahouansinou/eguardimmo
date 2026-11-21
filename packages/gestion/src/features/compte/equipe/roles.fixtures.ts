// Reproduit la sortie de GET /org/{organization}/roles : domaines et niveaux de RoleMatrix::domains() (backend/app/Modules/Organizations/Support/RoleMatrix.php).
export const ROLE_MATRIX_ROWS = [
  ['team', 'wwrr'],
  ['activity_log', 'rrr-'],
  ['activity_detail', 'rr--'],
  ['activity_export', '22--'],
  ['reference_data', 'wwrr'],
  ['mandates', 'wwwr'],
  ['mandate_documents', 'www-'],
  ['mandate_defaults', 'wwrr'],
  ['parties', 'wwwr'],
  ['parties_followup', 'www-'],
  ['parties_sensitive', '222-'],
  ['parties_anonymize', 'ww--'],
  ['properties', 'wwwr'],
  ['planning', 'wwwr'],
  ['planning_task_progress', 'wwww'],
  ['leases', 'wwwr'],
  ['leases_followup', 'www-'],
  ['inspections', 'www-'],
  ['rent_collection', 'wwwp'],
  ['rent_operations', 'www-'],
  ['rent_refunds', '22-2'],
  ['recovery', 'wwwr'],
  ['invoices', 'wwww'],
  ['credit_notes', 'ww-w'],
  ['owner_funds', 'pppp'],
  ['owner_funds_sensitive', '22-2'],
  ['charges', 'wwww'],
  ['charges_third_party', '22-2'],
  ['charges_issue', 'www-'],
  ['investments', 'ww-w'],
  ['investments_read', 'rrrr'],
  ['tax_read', 'rrrr'],
  ['tax_prepare', 'ww-w'],
  ['tax_publish', '222-'],
  ['tax_export', '22-2'],
  ['banking', '22-2'],
  ['banking_accounts', '22-r'],
  ['accounting_ledger', 'rr-r'],
  ['accounting_periods', 'rrrr'],
  ['maintenance', 'wwwr'],
  ['maintenance_invoices', 'wwww'],
  ['maintenance_allocations', 'ww-w'],
  ['maintenance_payments', '22-2'],
  ['reporting', 'wwww'],
  ['reporting_publish', 'www-'],
  ['reporting_export', '22-2'],
  ['reporting_assumptions', 'ww-w'],
  ['reporting_finance_export', 'rr-r'],
  ['messaging_external', 'www-'],
  ['messaging_moderation', '22--'],
  ['support_access', '22--'],
  ['privacy_requests', 'ww--'],
  ['campaigns', 'www-'],
  ['campaigns_send', '222-'],
  ['documents', 'wwwr'],
  ['online_payments', 'rrrr'],
  ['psp_account', '22--'],
] as const;

const LEVELS: Record<string, string> = { r: 'read', p: 'prepare', w: 'write', '2': 'write_two_factor', '-': 'none' };

interface RolesResponse {
  data: { current_role: string; domains: { key: string; levels: Record<'owner' | 'admin' | 'manager' | 'accountant', string>; two_factor: boolean }[] };
}

export function rolesResponse(currentRole: 'owner' | 'admin' | 'manager' | 'accountant' = 'owner'): RolesResponse {
  const level = (levels: string, index: number): string => LEVELS[levels.charAt(index)] ?? 'none';
  return {
    data: {
      current_role: currentRole,
      domains: ROLE_MATRIX_ROWS.map(([key, levels]) => ({
        key,
        levels: { owner: level(levels, 0), admin: level(levels, 1), manager: level(levels, 2), accountant: level(levels, 3) },
        two_factor: levels.includes('2'),
      })),
    },
  };
}
