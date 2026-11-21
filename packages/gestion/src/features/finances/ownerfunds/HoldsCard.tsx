'use client';

import { Button, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useAttemptKey } from './attemptKey';
import { useHolds, useOwnerFundsPermissions, usePartyNames, useReleaseHold } from './hooks';
import { holdKindLabel, holdReasonLabel, moneyText } from './labels';
import type { PayoutHold } from './model';
import { ConfirmAction } from './parts';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ListLoading, LoadError, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

export function HoldsCard({ mandantId }: { mandantId?: string }) {
  const permissions = useOwnerFundsPermissions();
  const pages = useCursorPages();
  const holds = useHolds({ cursor: pages.cursor, mandantId, activeOnly: true });
  const names = usePartyNames(holds.data?.items.map((hold) => hold.mandantId) ?? []);
  const [releasing, setReleasing] = useState<PayoutHold | null>(null);
  const release = useReleaseHold();
  const keyFor = useAttemptKey();
  const notify = useNotify();
  const rows = holds.data?.items ?? [];

  return (
    <Card role="region" aria-label="Retenues actives" className="gap-3">
      <h2 className="text-block-title text-fg">Retenues actives</h2>
      {holds.isError ? <LoadError title={holds.error?.message ?? 'Les retenues n’ont pas pu être chargées'} /> : null}
      {holds.isPending && !holds.isError ? <ListLoading label="Chargement des retenues" /> : null}
      {holds.data && rows.length === 0 ? <EmptyState icon={ShieldAlert} title="Aucune retenue active" description="Une retenue bloque ou réserve une partie du net reversable d’un mandant." /> : null}
      {rows.length > 0 ? (
        <Table aria-label="Retenues actives">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mandant</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell numeric>Montant retenu</TableHeaderCell>
              <TableHeaderCell>Motif</TableHeaderCell>
              <TableHeaderCell>Posée le</TableHeaderCell>
              {permissions.sensitive ? <TableHeaderCell><span className="sr-only">Action</span></TableHeaderCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((hold) => (
              <TableRow key={hold.id}>
                <TableCell strong>{names(hold.mandantId)}</TableCell>
                <TableCell>{holdKindLabel[hold.kind]}</TableCell>
                <TableCell numeric>{hold.amount ? moneyText(hold.amount) : 'Tout le net'}</TableCell>
                <TableCell title={hold.comment ?? undefined}>{holdReasonLabel[hold.reason]}</TableCell>
                <TableCell>{formatDateFr(hold.createdAt)}</TableCell>
                {permissions.sensitive ? (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { setReleasing(hold); }}>
                      Lever{' '}<span className="sr-only">{`la retenue de ${names(hold.mandantId)}`}</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={holds.data?.nextCursor ?? null} label="Pagination des retenues" />
      <ConfirmAction
        open={releasing !== null}
        title="Lever cette retenue ?"
        description={releasing ? `La retenue (${holdReasonLabel[releasing.reason].toLowerCase()}) de ${names(releasing.mandantId)} sera levée : son montant redevient reversible.` : ''}
        confirmLabel="Lever la retenue"
        failureTitle="Retenue non levée"
        onClose={() => { setReleasing(null); }}
        run={async () => {
          if (!releasing) return;
          await release.mutateAsync({ holdId: releasing.id, key: keyFor(releasing.id) });
          notify({ title: 'Retenue levée', description: `${names(releasing.mandantId)} : le montant retenu redevient reversible.` });
        }}
      />
    </Card>
  );
}
