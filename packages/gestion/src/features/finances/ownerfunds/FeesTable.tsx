'use client';

import { Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Percent } from 'lucide-react';
import { useFees, usePartyNames } from './hooks';
import { feeKindLabel, moneyText, rateText } from './labels';
import type { FeeStatement } from './model';
import { ownerFundsPaths } from './paths';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { ListLoading, LoadError, useGestionNavigation } from '../../locataires/kit';
import { monthLabel } from '../../locataires/kit/dates';

export function FeesTable({ month, mandantId, showMandant = true }: { month?: string; mandantId?: string; showMandant?: boolean }) {
  const pages = useCursorPages();
  const fees = useFees({ cursor: pages.cursor, month, mandantId });
  const names = usePartyNames(fees.data?.items.map((fee) => fee.mandantId) ?? []);
  const rows = fees.data?.items ?? [];

  return (
    <>
      {fees.isError ? <LoadError title={fees.error?.message ?? 'Les honoraires n’ont pas pu être chargés'} /> : null}
      {fees.isPending && !fees.isError ? <ListLoading label="Chargement des honoraires" /> : null}
      {fees.data && rows.length === 0 ? (
        <EmptyState icon={Percent} title="Aucun honoraire calculé" description="Les honoraires d’un mois clos sont calculés par le serveur à la validation du premier lot qui les requiert." />
      ) : null}
      {rows.length > 0 ? (
        <Table aria-label="Honoraires de gestion">
          <TableHead>
            <TableRow>
              {showMandant ? <TableHeaderCell>Mandant</TableHeaderCell> : null}
              <TableHeaderCell>Mois</TableHeaderCell>
              <TableHeaderCell numeric>Loyers encaissés</TableHeaderCell>
              <TableHeaderCell numeric>Charges encaissées</TableHeaderCell>
              <TableHeaderCell>Barème appliqué</TableHeaderCell>
              <TableHeaderCell numeric>Honoraires HT</TableHeaderCell>
              <TableHeaderCell numeric>TVA</TableHeaderCell>
              <TableHeaderCell numeric>Total TTC</TableHeaderCell>
              <TableHeaderCell numeric>Reporté</TableHeaderCell>
              <TableHeaderCell>Facture</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((fee) => (
              <FeeRow key={fee.id} fee={fee} name={names(fee.mandantId)} showMandant={showMandant} />
            ))}
          </TableBody>
        </Table>
      ) : null}
      <CursorPager pages={pages} nextCursor={fees.data?.nextCursor ?? null} label="Pagination des honoraires" />
    </>
  );
}

function FeeRow({ fee, name, showMandant }: { fee: FeeStatement; name: string; showMandant: boolean }) {
  const { Link } = useGestionNavigation();
  return (
    <TableRow>
      {showMandant ? (
        <TableCell strong>
          <Link href={ownerFundsPaths.mandant(fee.mandantId)} className="text-action-on-subtle underline-offset-2 hover:underline">{name}</Link>
        </TableCell>
      ) : null}
      <TableCell>{monthLabel(fee.month)}</TableCell>
      <TableCell numeric>{moneyText(fee.baseRent)}</TableCell>
      <TableCell numeric>{moneyText(fee.baseCharges)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          {feeKindLabel[fee.feeKind]}
          {fee.feeKind === 'percentage' ? ` ${rateText(fee.rateBp)}` : ''}
          {fee.minimumApplied ? <Badge tone="info">Minimum appliqué</Badge> : null}
        </span>
      </TableCell>
      <TableCell numeric>{moneyText(fee.feeNet)}</TableCell>
      <TableCell numeric>{moneyText(fee.taxAmount)}</TableCell>
      <TableCell numeric className="font-medium text-fg">{moneyText(fee.feeTotal)}</TableCell>
      <TableCell numeric>{fee.carriedNet.amount === 0 ? '—' : moneyText(fee.carriedNet)}</TableCell>
      <TableCell>
        {fee.invoiceId ? (
          <Link href={ownerFundsPaths.invoice(fee.invoiceId)} className="text-action-on-subtle underline-offset-2 hover:underline">
            Facture{' '}<span className="sr-only">{`d’honoraires de ${name}, ${monthLabel(fee.month)}`}</span>
          </Link>
        ) : (
          'Pas encore facturée'
        )}
      </TableCell>
    </TableRow>
  );
}
