import { useOrganizationSession } from "@eguardimmo/shell";
import { dataSource } from "@/lib/env";

export type OrgRole = "owner" | "admin" | "manager" | "accountant";

export const ACCOUNTING_ROLES: readonly OrgRole[] = ["owner", "admin", "accountant"];
export const LISTING_ROLES: readonly OrgRole[] = ["owner", "admin", "manager"];
export const ADMIN_ROLES: readonly OrgRole[] = ["owner", "admin"];

export const DEMO_ROLE: OrgRole = "admin";

export interface ModuleAccess {
  accounting: boolean;
  listings: boolean;
  settings: boolean;
}

export function moduleAccessOf(role: OrgRole | null): ModuleAccess {
  return {
    accounting: role !== null && ACCOUNTING_ROLES.includes(role),
    listings: role !== null && LISTING_ROLES.includes(role),
    settings: role !== null && ADMIN_ROLES.includes(role),
  };
}

export function useOrgRole(): OrgRole | null {
  const session = useOrganizationSession();
  if (dataSource === "demo") return DEMO_ROLE;
  return session?.organization.role ?? null;
}

export function useModuleAccess(): ModuleAccess {
  return moduleAccessOf(useOrgRole());
}
