'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Icon, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { NotebookPen, Plus } from 'lucide-react';
import { useState } from 'react';
import { ActDialog } from './ActDialog';
import { useActs, useRecoveryPermissions } from './hooks';
import { actLabel, isActive } from './labels';
import type { RecoveryAct, RecoveryCase } from './model';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ListLoading, LoadError } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

const detailOf = (act: RecoveryAct): string => {
  const parts = [act.reference, act.recipientName ? `Destinataire : ${act.recipientName}` : null, act.piecesCount !== null ? `${String(act.piecesCount)} pièces` : null, act.expiresAt ? `Lien valable jusqu’au ${formatDateFr(act.expiresAt.slice(0, 10))}` : null, act.note];
  return parts.filter((part): part is string => part !== null && part !== '').join(' · ');
};

export function DiligencesCard({ recoveryCase }: { recoveryCase: RecoveryCase }) {
  const permissions = useRecoveryPermissions();
  const pages = useCursorPages();
  const [adding, setAdding] = useState(false);
  const acts = useActs(recoveryCase.id, { cursor: pages.cursor });
  const rows = acts.data?.items ?? [];
  const editable = permissions.write && isActive(recoveryCase.status);

  return (
    <Card role="region" aria-label="Carnet des diligences" className="gap-3">
      <CardHeader>
        <CardTitle as="h2">Carnet des diligences</CardTitle>
        {editable ? (
          <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
            <Icon icon={Plus} />
            Ajouter une diligence
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {acts.isError ? <LoadError title={acts.error?.message ?? 'Le carnet n’a pas pu être chargé'} /> : null}
        {acts.isPending && !acts.isError ? <ListLoading label="Chargement du carnet" /> : null}
        {acts.data && rows.length === 0 ? <EmptyState icon={NotebookPen} title="Aucune diligence" description="Ajoutez une relance, un appel ou une mise en demeure pour tracer les démarches." /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Carnet des diligences">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Acte</TableHeaderCell>
                <TableHeaderCell>Détail</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((act) => (
                <TableRow key={act.id}>
                  <TableCell>{formatDateFr(act.performedOn)}</TableCell>
                  <TableCell strong>
                    <span className="flex flex-wrap items-center gap-1">
                      {actLabel[act.type]}
                      {act.type === 'transmission' || act.type === 'revocation' ? <Badge tone="info">Automatique</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell>{detailOf(act) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={acts.data?.nextCursor ?? null} label="Pagination du carnet" />
      </CardContent>
      <ActDialog caseId={recoveryCase.id} open={adding} onClose={() => { setAdding(false); }} />
    </Card>
  );
}
