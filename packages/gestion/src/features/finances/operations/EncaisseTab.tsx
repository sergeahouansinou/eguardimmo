'use client';

import { Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { MODE_LABELS } from '../labels';
import { EmptyBlock, PagedFooter, PAGE_SIZE } from '../parts';
import type { ScreenProps } from '../parts';
import { bienLabel } from './rows';
import type { PaiementRow } from './rows';

export function EncaisseTab({ Link, rows, page, onPage, money, filtered }: Pick<ScreenProps, 'Link'> & { rows: PaiementRow[]; page: number; onPage: (page: number) => void; money: (minor: number) => string; filtered: boolean }) {
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <EmptyBlock title={filtered ? 'Aucun encaissement ne correspond aux filtres' : 'Aucun encaissement sur la période'}>
          Les paiements enregistrés apparaissent ici.
        </EmptyBlock>
      ) : (
        <Table aria-label="Encaissements">
          <TableHead>
            <tr>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Locataire</TableHeaderCell>
              <TableHeaderCell>Bien</TableHeaderCell>
              <TableHeaderCell>Libellé</TableHeaderCell>
              <TableHeaderCell>Mode</TableHeaderCell>
              <TableHeaderCell numeric>Montant</TableHeaderCell>
              <TableHeaderCell>Document</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {visible.map(({ paiement, bail }) => (
              <TableRow key={paiement.id}>
                <TableCell>{formatDate(paiement.date)}</TableCell>
                <TableCell strong>{bail.locataire}</TableCell>
                <TableCell>{bienLabel(bail)}</TableCell>
                <TableCell>{paiement.libelle}</TableCell>
                <TableCell>{MODE_LABELS[paiement.mode]}</TableCell>
                <TableCell numeric>{money(paiement.montant)}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" asChild>
                    <Link href={paiement.recuId ? `/finances/recus/${paiement.recuId}` : '/documents/quittances'}>{paiement.recuId ? 'Ouvrir le reçu' : 'Quittances'}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <PagedFooter page={page} total={rows.length} onPageChange={onPage} label="Pagination des encaissements" />
    </div>
  );
}
