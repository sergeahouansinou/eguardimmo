'use client';

import { Download, FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Dialog, DialogClose, DialogContent, Icon, IconButton } from '@eguardimmo/ui';
import { formatMoney } from '../../../format/money';
import { formatDate } from '../shared/dates';
import { downloadFile, toCsv } from '../shared/download';
import { PrintArea } from '../shared/PrintArea';
import { SettingsCard } from '../shared/SettingRow';
import { planOf } from './plans';
import type { Invoice } from './schemas';

const STATUS_LABELS: Record<Invoice['status'], string> = { payee: 'Payée', 'en-attente': 'En attente' };

export function invoicesToCsv(invoices: readonly Invoice[]): string {
  return toCsv([
    ['Numéro', 'Date', 'Formule', 'Montant HT', 'Statut'],
    ...invoices.map((invoice) => [
      invoice.id,
      formatDate(invoice.date),
      `${planOf(invoice.planId).name}, ${invoice.billing === 'annuel' ? 'annuel' : 'mensuel'}`,
      formatMoney(invoice.amount, 'EUR'),
      STATUS_LABELS[invoice.status],
    ]),
  ]);
}

function InvoiceDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const plan = planOf(invoice.planId);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        title={`Facture ${invoice.id}`}
        description="Aperçu de la facture d'abonnement."
        className="max-h-[90vh] w-[min(640px,calc(100vw-32px))]"
      >
        <div className="overflow-y-auto p-4">
          <PrintArea label={`Facture ${invoice.id}`}>
            <div className="flex flex-col gap-4 text-[13px] leading-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <b className="block text-[15px]">Facture {invoice.id}</b>
                  <span>Émise le {formatDate(invoice.date)}</span>
                </div>
                <div className="text-right">
                  <b className="block">eGuardImmo</b>
                  <span>Abonnement {plan.name}</span>
                </div>
              </div>
              <div>
                <span className="block">Client : Awa Diallo</span>
                <span className="block">12 rue des Lilas, 75011 Paris</span>
              </div>
              <table className="w-full border-collapse">
                <caption className="sr-only">Détail de la facture</caption>
                <tbody>
                  <tr>
                    <th scope="row" className="border-b border-line py-1 text-left font-normal">
                      Formule {plan.name}, paiement {invoice.billing === 'annuel' ? 'annuel' : 'mensuel'}
                    </th>
                    <td className="border-b border-line py-1 text-right tabular-nums">{formatMoney(invoice.amount, 'EUR')}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-1 text-left font-semibold">Total HT</th>
                    <td className="py-1 text-right font-semibold tabular-nums">{formatMoney(invoice.amount, 'EUR')}</td>
                  </tr>
                </tbody>
              </table>
              <span>Statut : {STATUS_LABELS[invoice.status]}</span>
            </div>
          </PrintArea>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
          <DialogClose asChild>
            <Button variant="secondary">Fermer</Button>
          </DialogClose>
          <Button
            variant="secondary"
            onClick={() => { downloadFile(`${invoice.id}.csv`, invoicesToCsv([invoice]), 'text/csv;charset=utf-8'); }}
          >
            <Icon icon={Download} />
            Télécharger en CSV
          </Button>
          <Button onClick={() => { window.print(); }}>
            <Icon icon={Printer} />
            Imprimer ou enregistrer en PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PREVIEW_COUNT = 3;

export function InvoicesCard({ invoices }: { invoices: readonly Invoice[] }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Invoice | null>(null);
  const shown = all ? invoices : invoices.slice(0, PREVIEW_COUNT);
  return (
    <SettingsCard
      id="ab-inv"
      title="Factures"
      aside={
        invoices.length > PREVIEW_COUNT ? (
          <Button variant="link" size="sm" aria-expanded={all} onClick={() => { setAll((previous) => !previous); }}>
            {all ? 'Réduire' : 'Tout voir'}
          </Button>
        ) : undefined
      }
    >
      {invoices.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">Aucune facture pour le moment.</p>
      ) : (
        <ul>
          {shown.map((invoice) => (
            <li key={invoice.id} className="flex min-h-11 items-center gap-2 border-t border-line first:border-t-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-body font-medium text-fg">{invoice.id}</b>
                <span className="text-caption text-fg-subtle">{formatDate(invoice.date)}</span>
              </span>
              <Badge tone={invoice.status === 'payee' ? 'success' : 'warning'}>{STATUS_LABELS[invoice.status]}</Badge>
              <span className="text-body font-semibold tabular-nums">{formatMoney(invoice.amount, 'EUR')}</span>
              <IconButton label={`Aperçu du PDF de la facture ${invoice.id}`} icon={FileText} onClick={() => { setOpen(invoice); }} />
            </li>
          ))}
        </ul>
      )}
      {all ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => { downloadFile('factures-egardimmo.csv', invoicesToCsv(invoices), 'text/csv;charset=utf-8'); }}
        >
          <Icon icon={Download} />
          Exporter en CSV
        </Button>
      ) : null}
      {open ? <InvoiceDialog invoice={open} onClose={() => { setOpen(null); }} /> : null}
    </SettingsCard>
  );
}
