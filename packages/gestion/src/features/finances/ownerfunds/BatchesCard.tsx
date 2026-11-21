'use client';

import { Badge, Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import { useBatches } from './hooks';
import { batchBadge } from './labels';
import { ownerFundsPaths } from './paths';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ListLoading, LoadError, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

export function BatchesCard() {
  const { Link } = useGestionNavigation();
  const pages = useCursorPages();
  const batches = useBatches(pages.cursor);
  const rows = batches.data?.items ?? [];

  return (
    <Card role="region" aria-label="Lots de reversement" className="gap-3">
      <h2 className="text-block-title text-fg">Lots de reversement</h2>
      {batches.isError ? <LoadError title={batches.error?.message ?? 'Les lots n’ont pas pu être chargés'} /> : null}
      {batches.isPending && !batches.isError ? <ListLoading label="Chargement des lots" /> : null}
      {batches.data && rows.length === 0 ? <EmptyState icon={Send} title="Aucun lot" description="Préparez un lot depuis le net à reverser ci-dessus." /> : null}
      {rows.length > 0 ? (
        <Table aria-label="Lots de reversement">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Lot</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell>Créé le</TableHeaderCell>
              <TableHeaderCell>Validé le</TableHeaderCell>
              <TableHeaderCell>Contrôle</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell strong>
                  <Link href={ownerFundsPaths.batch(batch.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{batch.number ?? 'Brouillon'}</Link>
                </TableCell>
                <TableCell><Badge tone={batchBadge[batch.status].tone}>{batchBadge[batch.status].label}</Badge></TableCell>
                <TableCell>{formatDateFr(batch.createdAt)}</TableCell>
                <TableCell>{formatDateFr(batch.validatedAt)}</TableCell>
                <TableCell>{batch.status === 'draft' ? '—' : batch.secondApproverRequired ? 'Second approbateur requis' : 'Un seul approbateur'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={batches.data?.nextCursor ?? null} label="Pagination des lots" />
    </Card>
  );
}
