'use client';

import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatQuantity, formatRate } from './amounts';
import { moneyText, taxCategoryLabel } from './labels';
import type { Invoice } from './model';
import { LedgerLines } from '../../locataires/kit';

export function InvoiceLinesCard({ invoice }: { invoice: Invoice }) {
  const lines = invoice.lines ?? [];
  const taxes = invoice.taxes ?? [];
  return (
    <Card role="region" aria-label="Lignes de la facture" className="gap-3">
      <CardHeader><CardTitle as="h2">Lignes</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table aria-label="Lignes de la facture">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Libellé</TableHeaderCell>
              <TableHeaderCell numeric>Quantité</TableHeaderCell>
              <TableHeaderCell numeric>Prix unitaire HT</TableHeaderCell>
              <TableHeaderCell numeric>Total HT</TableHeaderCell>
              <TableHeaderCell>Taxe</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell strong>{line.description}</TableCell>
                <TableCell numeric>{formatQuantity(line.quantityMilli)}</TableCell>
                <TableCell numeric>{moneyText(line.unitPrice)}</TableCell>
                <TableCell numeric>{moneyText(line.netAmount)}</TableCell>
                <TableCell>{`${taxCategoryLabel[line.taxCategory]}, ${formatRate(line.taxRatePcm)}`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="ml-auto w-full max-w-sm">
          <LedgerLines
            lines={[
              { label: 'Total hors taxe', value: moneyText(invoice.totalNet) },
              ...taxes.map((tax) => ({ label: `${tax.taxCode.toUpperCase()} ${formatRate(tax.ratePcm)} sur ${moneyText(tax.base)}`, value: moneyText(tax.amount) })),
            ]}
            total={{ label: 'Total TTC', value: moneyText(invoice.totalGross) }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
