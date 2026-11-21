'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, Icon, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { FileX, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddItemsDialog } from './AddItemsDialog';
import { useRecoveryPermissions, useRemoveItem } from './hooks';
import { isActive, receivableTarget, receivableTitle } from './labels';
import type { CaseItem, RecoveryCase } from './model';
import { moneyText } from '../rent/labels';
import { errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function CaseItemsCard({ recoveryCase }: { recoveryCase: RecoveryCase }) {
  const permissions = useRecoveryPermissions();
  const notify = useNotify();
  const remove = useRemoveItem();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CaseItem | null>(null);
  const editable = permissions.write && isActive(recoveryCase.status);

  const confirmRemove = async (item: CaseItem) => {
    try {
      await remove.mutateAsync({ caseId: recoveryCase.id, itemId: item.id });
      notify({ title: 'Créance retirée', description: `${capitalized(receivableTarget(item))} n’est plus dans le dossier.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Retrait impossible', description: errorMessage(error) });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card role="region" aria-label="Créances du dossier" className="gap-3">
      <CardHeader>
        <CardTitle as="h2">Créances du dossier</CardTitle>
        {editable ? (
          <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
            <Icon icon={Plus} />
            Ajouter des créances
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {recoveryCase.items.length === 0 ? (
          <EmptyState icon={FileX} title="Aucune créance" description="Ajoutez au moins une créance avant de générer un envoi de pièces." />
        ) : (
          <Table aria-label="Créances du dossier">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Créance</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Total</TableHeaderCell>
                <TableHeaderCell numeric>Dû à l’inclusion</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Incluse le</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recoveryCase.items.map((item) => {
                const title = receivableTitle(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell strong>
                      {title}
                      {item.type === 'invoice' && item.issuedOn ? <span className="block text-caption font-normal text-fg-subtle">{`émise le ${formatDateFr(item.issuedOn)}`}</span> : null}
                    </TableCell>
                    <TableCell>{formatDateFr(item.dueDate)}</TableCell>
                    <TableCell numeric>{moneyText(item.total)}</TableCell>
                    <TableCell numeric>{moneyText(item.amountDueAtInclusion)}</TableCell>
                    <TableCell numeric className={item.outstanding && item.outstanding.amount > 0 ? 'text-fg-danger' : undefined}>{item.outstanding ? moneyText(item.outstanding) : '—'}</TableCell>
                    <TableCell>{item.removedAt ? <Badge tone="neutral">{`Retirée le ${formatDateFr(item.removedAt.slice(0, 10))}`}</Badge> : formatDateFr(item.includedAt.slice(0, 10))}</TableCell>
                    <TableCell>
                      {editable && item.removedAt === null ? <IconButton label={`Retirer ${receivableTarget(item)}`} icon={Trash2} variant="danger" onClick={() => { setRemoving(item); }} /> : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AddItemsDialog recoveryCase={recoveryCase} open={adding} onClose={() => { setAdding(false); }} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Retirer la créance du dossier ?"
        description={removing ? `${capitalized(receivableTarget(removing))} sort du dossier et redevient disponible pour un autre. Rien n’est effacé : le retrait reste visible.` : ''}
        confirmLabel="Retirer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => { if (removing) void confirmRemove(removing); }}
      />
    </Card>
  );
}
