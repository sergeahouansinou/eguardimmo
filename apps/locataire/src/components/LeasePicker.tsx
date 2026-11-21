'use client';

import { Select } from '@eguardimmo/ui';
import type { LeaseSummary } from '@/tenant/model';

export function leaseOptionLabel(lease: LeaseSummary): string {
  return lease.mainUnit === null ? lease.reference : `${lease.reference} · ${lease.mainUnit.address}`;
}

export function LeasePicker({ leases, value, onChange }: { leases: readonly LeaseSummary[]; value: string; onChange: (leaseId: string) => void }) {
  if (leases.length < 2) return null;
  return (
    <Select
      label="Bail concerné"
      placeholder="Choisir un bail"
      className="w-full sm:w-96"
      value={value}
      options={leases.map((lease) => ({ value: lease.id, label: leaseOptionLabel(lease) }))}
      onValueChange={onChange}
    />
  );
}
