'use client';

import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { itemBadge, exclusionLabel, moneyText } from './labels';
import type { PayoutBatch, PayoutItem } from './model';
import type { PartyNames } from './hooks';
import { useOwnerFundsPermissions } from './hooks';
import { formatDateFr } from '../../locataires/kit/dates';

export type ItemAction = 'include' | 'exclude' | 'execute' | 'fail' | 'return';

export function availableActions(batch: PayoutBatch, item: PayoutItem, permissions: { prepare: boolean; sensitive: boolean }): ItemAction[] {
  const actions: ItemAction[] = [];
  if (batch.status === 'draft' && permissions.prepare) {
    if (item.status === 'included') actions.push('exclude');
    if (item.status === 'excluded' && item.exclusionReason === 'manual') actions.push('include');
  }
  if (item.status === 'pending' && permissions.sensitive) actions.push('execute', 'fail');
  if (item.status === 'paid' && permissions.sensitive) actions.push('return');
  return actions;
}

const ACTION_LABEL: Record<ItemAction, string> = {
  include: 'Inclure',
  exclude: 'Exclure',
  execute: 'Exécuter',
  fail: 'Signaler un échec',
  return: 'Retour bancaire',
};

export function BatchItemsTable({ batch, names, onAction }: { batch: PayoutBatch; names: PartyNames; onAction: (action: ItemAction, item: PayoutItem) => void }) {
  const permissions = useOwnerFundsPermissions();
  const items = batch.items ?? [];
  return (
    <Table aria-label="Mandants du lot">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Mandant</TableHeaderCell>
          <TableHeaderCell numeric>Net à reverser</TableHeaderCell>
          <TableHeaderCell numeric>Honoraires réglés</TableHeaderCell>
          <TableHeaderCell>Compte</TableHeaderCell>
          <TableHeaderCell>État</TableHeaderCell>
          <TableHeaderCell>Virement</TableHeaderCell>
          <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => {
          const badge = itemBadge[item.status];
          const actions = availableActions(batch, item, permissions);
          return (
            <TableRow key={item.id}>
              <TableCell strong>{names(item.mandantId)}</TableCell>
              <TableCell numeric>{moneyText(item.netAmount)}</TableCell>
              <TableCell numeric>{moneyText(item.feesSettled)}</TableCell>
              <TableCell>{item.bankLast4 === null ? '—' : `IBAN •••• ${item.bankLast4}`}</TableCell>
              <TableCell>
                <span className="flex flex-col items-start gap-1">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {item.exclusionReason ? <span className="text-caption text-fg-subtle">{exclusionLabel[item.exclusionReason]}</span> : null}
                  {item.failureReason ? <span className="text-caption text-fg-subtle">{item.failureReason}</span> : null}
                </span>
              </TableCell>
              <TableCell>
                {item.executedOn ? `${formatDateFr(item.executedOn)}${item.bankReference ? ` · ${item.bankReference}` : ''}${item.executedSolo ? ' · sans second approbateur' : ''}` : '—'}
              </TableCell>
              <TableCell>
                <span className="flex gap-1">
                  {actions.map((action) => (
                    <Button key={action} variant="ghost" size="sm" onClick={() => { onAction(action, item); }}>
                      {ACTION_LABEL[action]}{' '}<span className="sr-only">{`pour ${names(item.mandantId)}`}</span>
                    </Button>
                  ))}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
