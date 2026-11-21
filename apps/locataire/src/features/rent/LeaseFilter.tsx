'use client';

import { Select } from '@eguardimmo/ui';
import { useLeases } from '@/tenant/queries';

export const ALL = 'all';

export function LeaseFilter({ value, onChange }: { value: string | null; onChange: (leaseId: string | null) => void }) {
  const leases = useLeases();
  const known = (leases.data?.pages ?? []).flatMap((page) => page.items).map((lease) => ({ value: lease.id, label: lease.reference }));
  const options = [{ value: ALL, label: 'Tous les baux' }, ...known];
  if (value !== null && !known.some((option) => option.value === value)) options.push({ value, label: 'Bail sélectionné' });
  return (
    <Select
      label="Bail"
      placeholder="Tous les baux"
      className="w-full sm:w-56"
      value={value ?? ALL}
      options={options}
      onValueChange={(next) => { onChange(next === ALL ? null : next); }}
    />
  );
}
