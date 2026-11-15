'use client';

import { Badge } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { useTenants, useUnits } from '../locataires/hooks';
import { formatDateFr } from '../locataires/kit/dates';
import { tenantNameOf, unitFullLabel } from '../locataires/schemas';
import type { Lease, LeaseStatus } from './schemas';

export const leaseStatusBadge: Record<LeaseStatus, { label: string; tone: BadgeTone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  a_venir: { label: 'À venir', tone: 'info' },
  en_cours: { label: 'En cours', tone: 'success' },
  preavis: { label: 'Préavis donné', tone: 'warning' },
  termine: { label: 'Terminé', tone: 'neutral' },
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  const badge = leaseStatusBadge[status];
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

export const leasePeriod = (lease: Pick<Lease, 'start' | 'end'>): string => `${formatDateFr(lease.start)} → ${formatDateFr(lease.end)}`;

export interface LeaseLookups {
  ready: boolean;
  unitLabel: (unitId: string) => string;
  unitShort: (unitId: string) => string;
  tenantName: (tenantId: string) => string;
  tenantCivility: (tenantId: string) => string;
  tenantsOf: (lease: Pick<Lease, 'tenantIds'>) => string;
}

export function useLeaseLookups(): LeaseLookups {
  const tenants = useTenants();
  const units = useUnits();
  const unitList = units.data ?? [];
  const tenantList = tenants.data ?? [];
  const tenantName = (tenantId: string) => {
    const tenant = tenantList.find((entry) => entry.id === tenantId);
    return tenant ? tenantNameOf(tenant) : tenantId;
  };
  return {
    ready: tenants.data !== undefined && units.data !== undefined,
    unitLabel: (unitId) => {
      const unit = unitList.find((entry) => entry.id === unitId);
      return unit ? unitFullLabel(unit) : unitId;
    },
    unitShort: (unitId) => unitList.find((entry) => entry.id === unitId)?.label ?? unitId,
    tenantName,
    tenantCivility: (tenantId) => tenantList.find((entry) => entry.id === tenantId)?.civility ?? '',
    tenantsOf: (lease) => (lease.tenantIds.length === 0 ? 'Aucun locataire' : lease.tenantIds.map(tenantName).join(', ')),
  };
}
