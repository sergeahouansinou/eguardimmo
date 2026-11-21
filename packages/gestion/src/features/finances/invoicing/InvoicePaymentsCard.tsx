'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { methodLabel, moneyText } from './labels';
import type { Invoice, InvoicePayment } from './model';
import { formatDateFr } from '../../locataires/kit/dates';

export function InvoicePaymentsCard({ invoice, canCancel, onCancel }: { invoice: Invoice; canCancel: boolean; onCancel: (payment: InvoicePayment) => void }) {
  const payments = invoice.payments ?? [];
  return (
    <Card role="region" aria-label="Règlements" className="gap-3">
      <CardHeader><CardTitle as="h2">Règlements</CardTitle></CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-body text-fg-subtle">Aucun règlement enregistré.</p>
        ) : (
          <Table aria-label="Règlements enregistrés">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Mode</TableHeaderCell>
                <TableHeaderCell>Référence</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
                <TableHeaderCell>État</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDateFr(payment.paidOn)}</TableCell>
                  <TableCell>{methodLabel[payment.method]}</TableCell>
                  <TableCell>{payment.reference ?? '—'}</TableCell>
                  <TableCell numeric>{moneyText(payment.amount)}</TableCell>
                  <TableCell>{payment.cancelledAt === null ? <Badge tone="success">Enregistré</Badge> : <Badge tone="neutral">{`Annulé le ${formatDateFr(payment.cancelledAt)}`}</Badge>}</TableCell>
                  <TableCell>
                    {canCancel && payment.cancelledAt === null ? (
                      <Button variant="ghost" size="sm" onClick={() => { onCancel(payment); }}>
                        Annuler<span className="sr-only">{` le règlement de ${moneyText(payment.amount)} du ${formatDateFr(payment.paidOn)}`}</span>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
