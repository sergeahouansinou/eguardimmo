'use client';

import { Badge, Card, ConfirmDialog, EmptyState, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Button, Icon } from '@eguardimmo/ui';
import { Download, Receipt, Send } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from './CursorPager';
import { RentSections } from './RentSections';
import { useReceiptDownload } from './useReceiptDownload';
import { useIssuePendingReceipts, useReceipts, useRentPermissions } from './hooks';
import { moneyText, periodLabel } from './labels';
import type { RentReceipt } from './model';
import { batchMessage } from './outcomes';
import { rentPaths } from './paths';
import { ListLoading, LoadError, PageHeader, errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function ReceiptsPage() {
  const { search } = useGestionNavigation();
  const permissions = useRentPermissions();
  const notify = useNotify();
  const pages = useCursorPages();
  const issuePending = useIssuePendingReceipts();
  const [confirming, setConfirming] = useState(false);
  const leaseId = search.get('bail') ?? undefined;
  const receipts = useReceipts({ cursor: pages.cursor, leaseId });
  const rows = receipts.data?.items ?? [];

  const runBatch = async () => {
    setConfirming(false);
    try {
      notify({ title: 'Quittances en attente traitées', description: batchMessage(await issuePending.mutateAsync(), { none: 'Aucune quittance à émettre.', one: 'quittance émise', many: 'quittances émises' }) });
    } catch (error) {
      notify({ tone: 'danger', title: 'Émission impossible', description: errorMessage(error) });
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Loyers', href: rentPaths.installments }, { label: 'Quittances' }]}
        title="Quittances"
        subtitle="Délivrées quand une échéance est soldée ; celles d’un paiement par chèque se demandent depuis l’échéance."
        actions={permissions.manage ? <Button variant="secondary" loading={issuePending.isPending} onClick={() => { setConfirming(true); }}><Icon icon={Send} />Émettre les quittances en attente</Button> : null}
      />
      <RentSections current="receipts" />
      <Card role="region" aria-label="Quittances" className="gap-3">
        {receipts.isError ? <LoadError title={receipts.error?.message ?? 'Les quittances n’ont pas pu être chargées'} /> : null}
        {receipts.isPending && !receipts.isError ? <ListLoading label="Chargement des quittances" /> : null}
        {receipts.data && rows.length === 0 ? <EmptyState icon={Receipt} title="Aucune quittance" description="Les quittances apparaissent quand une échéance est entièrement soldée." /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Quittances de loyer">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Numéro</TableHeaderCell>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Lot</TableHeaderCell>
                <TableHeaderCell>Période</TableHeaderCell>
                <TableHeaderCell numeric>Total</TableHeaderCell>
                <TableHeaderCell>Émise le</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((receipt) => (
                <ReceiptRow key={receipt.id} receipt={receipt} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={receipts.data?.nextCursor ?? null} label="Pagination des quittances" />
      </Card>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Émettre les quittances en attente ?"
        description="Une quittance est émise pour chaque échéance soldée dont la quittance n’a pas pu l’être automatiquement (100 au plus à la fois). Les échéances soldées par chèque restent à demander une à une."
        confirmLabel="Émettre les quittances"
        loading={issuePending.isPending}
        onConfirm={() => { void runBatch(); }}
      />
    </>
  );
}

function ReceiptRow({ receipt }: { receipt: RentReceipt }) {
  const { Link } = useGestionNavigation();
  const download = useReceiptDownload();
  return (
    <TableRow>
      <TableCell strong>
        <Link href={rentPaths.receipt(receipt.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{receipt.number}</Link>
      </TableCell>
      <TableCell>{receipt.tenants.join(', ') || '—'}</TableCell>
      <TableCell>{[receipt.unitReference, receipt.propertyName].filter(Boolean).join(', ') || '—'}</TableCell>
      <TableCell>{receipt.periodStart && receipt.periodEnd ? periodLabel(receipt.periodStart, receipt.periodEnd) : '—'}</TableCell>
      <TableCell numeric>{moneyText(receipt.total)}</TableCell>
      <TableCell>{formatDateFr(receipt.issuedOn)}</TableCell>
      <TableCell>{receipt.isVoid ? <Badge tone="danger">Nulle</Badge> : <Badge tone="success">Valable</Badge>}</TableCell>
      <TableCell><IconButton label={`Télécharger la quittance ${receipt.number} (PDF)`} icon={Download} onClick={() => { void download(receipt); }} /></TableCell>
    </TableRow>
  );
}
