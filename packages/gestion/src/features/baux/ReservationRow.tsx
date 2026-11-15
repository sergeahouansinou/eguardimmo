'use client';

import { Badge, Button, TableCell, TableRow } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { bauxPaths } from './paths';
import type { Reservation, ReservationStatus } from './schemas';
import { ActionMenu, LinkButton } from '../locataires/kit';
import type { ActionItem } from '../locataires/kit';
import { daysBetween, formatDateFr } from '../locataires/kit/dates';
import { money } from '../locataires/kit/money';

export const reservationStatusBadge: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  option: { label: 'Option', tone: 'warning' },
  confirmee: { label: 'Confirmée', tone: 'success' },
  acompte_recu: { label: 'Acompte reçu', tone: 'info' },
  solde_a_percevoir: { label: 'Solde à percevoir', tone: 'warning' },
  annulee: { label: 'Annulée', tone: 'neutral' },
};

export function ReservationRow({
  item,
  unit,
  actions,
  onConfirm,
  onRemind,
}: {
  item: Reservation;
  unit: string;
  actions: ActionItem[];
  onConfirm: () => void;
  onRemind: () => void;
}) {
  const badge = reservationStatusBadge[item.status];
  const owing = item.paid < item.amount && (item.status === 'acompte_recu' || item.status === 'solde_a_percevoir');
  return (
    <TableRow>
      <TableCell strong>{item.reference}</TableCell>
      <TableCell>{unit}</TableCell>
      <TableCell>{item.guest}</TableCell>
      <TableCell>{formatDateFr(item.arrival)}</TableCell>
      <TableCell>{formatDateFr(item.departure)}</TableCell>
      <TableCell numeric>{String(daysBetween(item.arrival, item.departure))}</TableCell>
      <TableCell numeric>{money(item.amount)}</TableCell>
      <TableCell numeric>{money(item.deposit)}</TableCell>
      <TableCell>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        {item.optionUntil ? <span className="block text-caption text-fg-subtle">{`Jusqu’au ${formatDateFr(item.optionUntil)}`}</span> : null}
        {item.paid > 0 && item.status !== 'annulee' && item.paid < item.amount ? <span className="block text-caption text-fg-subtle">{`${money(item.paid)} reçus`}</span> : null}
      </TableCell>
      <TableCell>
        <span className="flex items-center justify-end gap-1.5">
          {item.status === 'option' ? <Button variant="secondary" size="sm" onClick={onConfirm}>Confirmer</Button> : null}
          {owing ? <Button variant="secondary" size="sm" onClick={onRemind}>Relancer</Button> : null}
          {item.status !== 'option' && !owing && item.status !== 'annulee' ? <LinkButton href={bauxPaths.editReservation(item.id)} size="sm">Ouvrir</LinkButton> : null}
          <ActionMenu label={`Plus d’actions, ${item.reference}`} items={actions} />
        </span>
      </TableCell>
    </TableRow>
  );
}
