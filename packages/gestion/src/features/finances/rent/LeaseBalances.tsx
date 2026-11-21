'use client';

import { LeaseBalanceCard } from './LeaseBalanceCard';

export function LeaseBalances({ leases }: { leases: readonly { id: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {leases.map((lease) => (
        <LeaseBalanceCard key={lease.id} leaseId={lease.id} label={lease.label} />
      ))}
    </div>
  );
}
