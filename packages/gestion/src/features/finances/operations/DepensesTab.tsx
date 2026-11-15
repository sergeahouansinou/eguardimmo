'use client';

import { CircleX, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, Button, ConfirmDialog, MenuItem, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { EXPENSE_LABELS } from '../labels';
import { EmptyBlock, FINANCES_ROUTES, PagedFooter, PAGE_SIZE } from '../parts';
import type { ScreenProps, useExec } from '../parts';
import { RowMenu } from '../RowMenu';
import type { Depense } from '../schemas';

export function DepensesTab({
  navigate,
  rows,
  page,
  onPage,
  money,
  exec,
  filtered,
}: Pick<ScreenProps, 'navigate'> & { rows: Depense[]; page: number; onPage: (page: number) => void; money: (minor: number) => string; exec: ReturnType<typeof useExec>; filtered: boolean }) {
  const [cancelling, setCancelling] = useState<Depense | null>(null);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col gap-2">
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyBlock
          title={filtered ? 'Aucune dépense ne correspond aux filtres' : 'Aucune dépense sur la période'}
          action={
            <Button variant="secondary" onClick={() => { navigate(FINANCES_ROUTES.depense); }}>
              Ajouter une dépense
            </Button>
          }
        />
      ) : (
        <Table aria-label="Dépenses">
          <TableHead>
            <tr>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Bien</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Payé à</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell numeric>Montant TTC</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {visible.map((depense) => (
              <TableRow key={depense.id}>
                <TableCell>{formatDate(depense.date)}</TableCell>
                <TableCell strong>{depense.bien}</TableCell>
                <TableCell>{EXPENSE_LABELS[depense.type]}</TableCell>
                <TableCell>{depense.fournisseur}</TableCell>
                <TableCell className="max-w-64 truncate">{depense.description}</TableCell>
                <TableCell numeric>{money(depense.montantTtc)}</TableCell>
                <TableCell>{depense.annulee ? <Badge>Annulée</Badge> : depense.nonComptabilise ? <Badge tone="warning">Non comptabilisée</Badge> : <Badge tone="success">Comptabilisée</Badge>}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Button variant="link" size="sm" disabled={depense.annulee} onClick={() => { navigate(`${FINANCES_ROUTES.depense}?depense=${depense.id}`); }}>
                      Modifier
                    </Button>
                    <RowMenu>
                      <MenuItem icon={Pencil} disabled={depense.annulee} onSelect={() => { navigate(`${FINANCES_ROUTES.depense}?depense=${depense.id}`); }}>Modifier</MenuItem>
                      <MenuItem icon={CircleX} tone="danger" disabled={depense.annulee} onSelect={() => { setCancelling(depense); }}>Annuler la dépense</MenuItem>
                    </RowMenu>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <PagedFooter page={page} total={rows.length} onPageChange={onPage} label="Pagination des dépenses" />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title="Annuler la dépense ?"
        description={cancelling ? `La dépense de ${money(cancelling.montantTtc)} chez ${cancelling.fournisseur} ne sera plus comptabilisée.` : ''}
        confirmLabel="Annuler la dépense"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (cancelling) exec.run({ type: 'cancelExpense', depenseId: cancelling.id }, { onDone: () => { setCancelling(null); } }); }}
      />
    </div>
  );
}
