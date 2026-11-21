'use client';

import { useLeaseLookups } from '../../baux/BauxParts';
import { useLeases } from '../../baux/hooks';

export interface LeaseChoices {
  options: { value: string; label: string }[];
  referenceOf: (leaseId: string) => string | null;
  tenantOf: (partyId: string) => string | null;
  unitOf: (unitId: string) => string | null;
}

export function useLeaseChoices(): LeaseChoices {
  const leases = useLeases();
  const lookups = useLeaseLookups();
  const known = (label: string, id: string): string | null => (lookups.ready && label !== id ? label : null);
  const list = leases.data ?? [];
  return {
    options: list
      .filter((lease) => lease.unsupported === undefined && !lease.archived && lease.status !== 'brouillon')
      .map((lease) => ({ value: lease.id, label: [lease.reference, known(lookups.unitShort(lease.unitId), lease.unitId), lookups.ready ? lookups.tenantsOf(lease) : null].filter(Boolean).join(' · ') })),
    referenceOf: (leaseId) => list.find((lease) => lease.id === leaseId)?.reference ?? null,
    tenantOf: (partyId) => known(lookups.tenantName(partyId), partyId),
    unitOf: (unitId) => known(lookups.unitShort(unitId), unitId),
  };
}
