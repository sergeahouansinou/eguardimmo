import { Alert, Badge, Button } from '@eguardimmo/ui';
import { Receipt } from 'lucide-react';
import { ActionMenu, NoRows, SectionCard } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { allocatedTotal, paidTotal } from '../dialogs/SettlementDialogs';
import { invoiceBadge, methodLabel, moneyText, targetLabel } from '../labels';
import type { InterventionDetail, MaintenancePermissions, SupplierInvoice } from '../model';
import { useRowAction } from './rowActions';

export function InvoicesCard({
  intervention,
  permissions,
  canRecord,
  onRecord,
  onAllocate,
  onPay,
}: {
  intervention: InterventionDetail;
  permissions: MaintenancePermissions;
  canRecord: boolean;
  onRecord: () => void;
  onAllocate: (invoice: SupplierInvoice) => void;
  onPay: (invoice: SupplierInvoice) => void;
}) {
  const run = useRowAction();
  const itemsFor = (invoice: SupplierInvoice): ActionItem[] => {
    if (invoice.status === 'cancelled') return [];
    const hasLive = invoice.allocations.some((entry) => entry.cancelledAt === null) || invoice.payments.some((entry) => entry.cancelledAt === null);
    return [
      ...(permissions.settle && invoice.status === 'recorded' ? [{ id: 'allocate', label: 'Imputer la facture', onSelect: () => { onAllocate(invoice); } }] : []),
      ...(permissions.settle && paidTotal(invoice) < invoice.totalGross.amount ? [{ id: 'pay', label: 'Enregistrer un règlement', onSelect: () => { onPay(invoice); } }] : []),
      ...(permissions.finance && !hasLive ? [{ id: 'cancel', label: 'Annuler la facture', tone: 'danger' as const, separatorBefore: true, onSelect: () => { run('Facture annulée', (source) => source.cancelInvoice(intervention.id, invoice.id)); } }] : []),
    ];
  };
  return (
    <SectionCard
      id="factures"
      title="Factures du prestataire"
      aside={canRecord ? <Button variant="secondary" size="sm" onClick={onRecord}><Receipt aria-hidden className="size-4" />Enregistrer une facture</Button> : undefined}
    >
      {intervention.invoices.length === 0 ? <NoRows>Aucune facture reçue.</NoRows> : null}
      <ul className="flex flex-col">
        {intervention.invoices.map((invoice) => {
          const items = itemsFor(invoice);
          return (
            <li key={invoice.id} className="flex flex-col gap-1 border-t border-line py-2 first:border-t-0">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-body-strong text-fg">{`Facture ${invoice.number}`}</b>
                <span className="flex items-center gap-1">
                  <Badge tone={invoiceBadge[invoice.status].tone}>{invoiceBadge[invoice.status].label}</Badge>
                  {items.length > 0 ? <ActionMenu label={`Actions pour la facture ${invoice.number}`} items={items} /> : null}
                </span>
              </span>
              <span className="text-caption text-fg-subtle">{`Du ${formatDateFr(invoice.invoiceOn)} · ${moneyText(invoice.totalNet)} HT · ${moneyText(invoice.totalGross)} TTC · échéance ${formatDateFr(invoice.dueOn)}`}</span>
              {invoice.exceedsApprovedAmount ? <Alert tone="warning" title="Montant supérieur à l’accord">Cette facture dépasse le montant accordé : le règlement reste refusé tant qu’un avenant accepté ne la couvre pas.</Alert> : null}
              <span className="text-caption text-fg-muted">{`Imputé : ${moneyText({ amount: allocatedTotal(invoice), currency: invoice.totalGross.currency })} · Réglé : ${moneyText({ amount: paidTotal(invoice), currency: invoice.totalGross.currency })}`}</span>
              <ul className="text-caption text-fg-muted">
                {invoice.allocations.map((allocation) => (
                  <li key={allocation.id} className="flex flex-wrap items-center gap-1">
                    <span>{`Imputation ${targetLabel[allocation.target]} : ${moneyText(allocation.chargedAmount)}${allocation.cancelledAt ? ' (annulée)' : ''}`}</span>
                    {permissions.settle && allocation.cancelledAt === null ? (
                      <Button variant="link" size="sm" aria-label={`Annuler l’imputation ${targetLabel[allocation.target]} de ${moneyText(allocation.chargedAmount)}`} onClick={() => { run('Imputation annulée', (source) => source.cancelAllocation(allocation.id)); }}>Annuler</Button>
                    ) : null}
                  </li>
                ))}
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-1">
                    <span>{`Règlement ${methodLabel[payment.method]} du ${formatDateFr(payment.paidOn)} : ${moneyText(payment.amount)}${payment.cancelledAt ? ' (annulé)' : ''}`}</span>
                    {permissions.settle && payment.cancelledAt === null ? (
                      <Button variant="link" size="sm" aria-label={`Annuler le règlement de ${moneyText(payment.amount)} du ${formatDateFr(payment.paidOn)}`} onClick={() => { run('Règlement annulé', (source) => source.cancelPayment(payment.id)); }}>Annuler</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
