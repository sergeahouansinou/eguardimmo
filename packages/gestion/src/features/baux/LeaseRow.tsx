'use client';

import { Checkbox, TableCell, TableRow } from '@eguardimmo/ui';
import { LeaseStatusBadge } from './BauxParts';
import { useFeatureUnavailable } from './FeatureGate';
import { bauxPaths } from './paths';
import type { Lease } from './schemas';
import { ActionMenu, useGestionNavigation } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { money } from '../locataires/kit/money';

export function LeaseRow({
  lease,
  unit,
  tenants,
  checked,
  onToggle,
  actions,
}: {
  lease: Lease;
  unit: string;
  tenants: string;
  checked: boolean;
  onToggle: () => void;
  actions: ActionItem[];
}) {
  const { Link } = useGestionNavigation();
  const balanceOff = useFeatureUnavailable('balance');
  if (lease.unsupported !== undefined) {
    return (
      <TableRow>
        <TableCell />
        <TableCell strong>
          <Link href={bauxPaths.detail(lease.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {unit}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{lease.reference}</span>
        </TableCell>
        <TableCell>{tenants}</TableCell>
        <TableCell colSpan={balanceOff ? 6 : 7} className="text-fg-muted">{`Non affichable : ${lease.unsupported}`}</TableCell>
        <TableCell />
      </TableRow>
    );
  }
  return (
    <TableRow selected={checked}>
      <TableCell><Checkbox label={`Sélectionner ${lease.reference}`} hideLabel checked={checked} onChange={onToggle} /></TableCell>
      <TableCell strong>
        <Link href={bauxPaths.detail(lease.id)} className="text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {unit}
        </Link>
        <span className="block text-caption font-normal text-fg-subtle">{lease.reference}</span>
      </TableCell>
      <TableCell>{tenants}</TableCell>
      <TableCell>{lease.furnished ? 'Meublé' : 'Vide'}</TableCell>
      <TableCell numeric>{money(lease.rent)}</TableCell>
      <TableCell numeric>{money(lease.charges)}</TableCell>
      <TableCell numeric>{money(lease.deposit)}</TableCell>
      <TableCell>{formatDateFr(lease.end)}</TableCell>
      {balanceOff ? null : <TableCell numeric className={lease.balance < 0 ? 'text-fg-danger' : undefined}>{money(lease.balance)}</TableCell>}
      <TableCell><LeaseStatusBadge status={lease.status} /></TableCell>
      <TableCell><ActionMenu label={`Plus d’actions, bail ${lease.reference}`} items={actions} /></TableCell>
    </TableRow>
  );
}
