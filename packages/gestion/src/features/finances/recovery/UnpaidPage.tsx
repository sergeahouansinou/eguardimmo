'use client';

import { Badge, Button, Card, Checkbox, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FolderPlus, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { OpenCaseDialog } from './OpenCaseDialog';
import { RecoverySections } from './RecoverySections';
import { useRecoveryPermissions, useUnpaid } from './hooks';
import { ageTone, daysLabel, receivableTarget, receivableTitle } from './labels';
import type { UnpaidItem } from './model';
import { recoveryPaths } from './paths';
import { groupSelection } from './selection';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { moneyText } from '../rent/labels';
import { useLeaseChoices } from '../rent/useLeaseChoices';
import { ListLoading, LoadError, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'toutes';

export function UnpaidPage() {
  const permissions = useRecoveryPermissions();
  const choices = useLeaseChoices();
  const pages = useCursorPages();
  const [leaseId, setLeaseId] = useState(ALL);
  const [selected, setSelected] = useState<ReadonlyMap<string, UnpaidItem>>(new Map());
  const [confirming, setConfirming] = useState(false);

  const unpaid = useUnpaid({ after: pages.cursor, leaseId: leaseId === ALL ? undefined : leaseId });
  const rows = unpaid.data?.items ?? [];
  const selection = groupSelection([...selected.values()]);

  const toggle = (item: UnpaidItem, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(item.itemId, item);
      else next.delete(item.itemId);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Impayés' }]}
        title="Impayés"
        subtitle="Échéances et factures échues non soldées, reste dû lu au grand livre. Sélectionnez des créances d’un même locataire pour ouvrir un dossier de recouvrement."
        actions={
          permissions.write ? (
            <Button variant="primary" disabled={selected.size === 0} onClick={() => { setConfirming(true); }}>
              <Icon icon={FolderPlus} />
              {selected.size > 0 ? `Ouvrir un dossier (${String(selected.size)})` : 'Ouvrir un dossier'}
            </Button>
          ) : null
        }
      />
      <RecoverySections current="unpaid" />
      <Card role="region" aria-label="Impayés" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Bail"
            hideLabel
            placeholder="Bail"
            value={leaseId}
            onValueChange={(value) => { setLeaseId(value); pages.reset(); }}
            searchable
            searchPlaceholder="Rechercher un bail"
            options={[{ value: ALL, label: 'Tous les baux' }, ...choices.options]}
          />
        </div>
        {unpaid.isError ? <LoadError title={unpaid.error?.message ?? 'Les impayés n’ont pas pu être chargés'} /> : null}
        {unpaid.isPending && !unpaid.isError ? <ListLoading label="Chargement des impayés" /> : null}
        {unpaid.data && rows.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Aucun impayé" description={leaseId === ALL ? 'Toutes les échéances et factures échues sont soldées.' : 'Aucune créance échue impayée pour ce bail.'} />
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Créances impayées">
            <TableHead>
              <TableRow>
                <TableHeaderCell><span className="sr-only">Sélection</span></TableHeaderCell>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Bail</TableHeaderCell>
                <TableHeaderCell>Créance</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell>Ancienneté</TableHeaderCell>
                <TableHeaderCell numeric>Total</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Dossier</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <UnpaidRow key={row.itemId} row={row} writable={permissions.write} checked={selected.has(row.itemId)} onToggle={toggle} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={unpaid.data?.nextAfter ?? null} label="Pagination des impayés" />
      </Card>
      <OpenCaseDialog open={confirming} selection={selection} onClose={() => { setConfirming(false); }} onOpened={() => { setConfirming(false); setSelected(new Map()); }} />
    </>
  );
}

function UnpaidRow({ row, writable, checked, onToggle }: { row: UnpaidItem; writable: boolean; checked: boolean; onToggle: (item: UnpaidItem, checked: boolean) => void }) {
  const { Link } = useGestionNavigation();
  const selectable = writable && row.caseRef === null && row.partyId !== null;
  return (
    <TableRow>
      <TableCell>
        {selectable ? <Checkbox label={`Sélectionner ${receivableTarget(row)} de ${row.partyName ?? 'locataire inconnu'}`} hideLabel checked={checked} onChange={(event) => { onToggle(row, event.target.checked); }} /> : null}
      </TableCell>
      <TableCell strong>{row.partyName ?? 'Locataire inconnu'}</TableCell>
      <TableCell>{row.leaseReference ?? '—'}</TableCell>
      <TableCell>
        {receivableTitle(row)}
        {row.type === 'invoice' && row.issuedOn ? <span className="block text-caption text-fg-subtle">{`émise le ${formatDateFr(row.issuedOn)}`}</span> : null}
      </TableCell>
      <TableCell>{formatDateFr(row.dueDate)}</TableCell>
      <TableCell><Badge tone={ageTone(row.daysOverdue)}>{daysLabel(row.daysOverdue)}</Badge></TableCell>
      <TableCell numeric>{moneyText(row.total)}</TableCell>
      <TableCell numeric className="text-fg-danger">{moneyText(row.outstanding)}</TableCell>
      <TableCell>
        {row.caseRef ? (
          <Link href={recoveryPaths.case(row.caseRef.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{row.caseRef.number}</Link>
        ) : (
          <span className="text-caption text-fg-subtle">Aucun</span>
        )}
      </TableCell>
    </TableRow>
  );
}
