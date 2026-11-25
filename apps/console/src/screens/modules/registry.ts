import type { Plan, PlanEntitlement } from '@/platform/plans/plans';

export const GROUP_ORDER = ['socle', 'gestion', 'suivi', 'pilotage'] as const;

export interface FeaturePlan {
  code: string;
  name: string;
  version: number;
  enabled: boolean;
  limit: number | null;
}

export interface FeatureRow {
  feature: string;
  label: string;
  group: string;
  kind: PlanEntitlement['kind'];
  plans: FeaturePlan[];
}

const groupRank = (group: string): number => {
  const rank = GROUP_ORDER.findIndex((candidate) => candidate === group);
  return rank === -1 ? GROUP_ORDER.length : rank;
};

export function buildRegistry(plans: readonly Plan[]): FeatureRow[] {
  const published = plans.flatMap((plan) => {
    const version = plan.versions.filter((candidate) => candidate.status === 'published').sort((a, b) => b.version - a.version)[0];
    return version === undefined ? [] : [{ plan, version }];
  });
  const rows = new Map<string, FeatureRow>();
  for (const { version } of published) {
    for (const entitlement of version.entitlements) {
      if (!rows.has(entitlement.feature)) rows.set(entitlement.feature, { feature: entitlement.feature, label: entitlement.label, group: entitlement.group, kind: entitlement.kind, plans: [] });
    }
  }
  for (const row of rows.values()) {
    row.plans = published.map(({ plan, version }) => {
      const entitlement = version.entitlements.find((candidate) => candidate.feature === row.feature);
      return { code: plan.code, name: plan.name, version: version.version, enabled: entitlement?.enabled ?? false, limit: entitlement?.limit ?? null };
    });
  }
  return [...rows.values()].sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.label.localeCompare(b.label, 'fr'));
}

export const includedIn = (row: FeatureRow): FeaturePlan[] => row.plans.filter((plan) => plan.enabled);

export interface RegistryFilter {
  group: string;
  search: string;
}

export function filterRegistry(rows: readonly FeatureRow[], { group, search }: RegistryFilter): FeatureRow[] {
  const needle = search.trim().toLocaleLowerCase('fr');
  return rows.filter((row) => (group === '' || row.group === group) && (needle === '' || row.label.toLocaleLowerCase('fr').includes(needle) || row.feature.includes(needle)));
}

export function limitText(plan: FeaturePlan): string {
  if (!plan.enabled) return '—';
  return plan.limit === null ? 'Illimité' : String(plan.limit);
}
