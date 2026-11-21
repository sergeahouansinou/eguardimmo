'use client';

import { ConfirmDialog } from '@eguardimmo/ui';
import { Banknote, Download, FilePenLine, Mail, ReceiptText, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CreditNoteDialog } from './CreditNoteDialog';
import { PaymentDialog } from './PaymentDialog';
import { useCancelInvoicePayment, useDiscardDraft, useInvoicePdf, useInvoicingPermissions, useIssueInvoice, useSendInvoice } from './hooks';
import { documentName, moneyText } from './labels';
import { SEND_LIMIT_PER_INVOICE, SEND_LIMIT_PER_ORGANIZATION } from './model';
import type { Invoice, InvoicePayment } from './model';
import { invoicingPaths } from './paths';
import { safeFilename, saveBlob } from '../rent/download';
import { errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';

type Pending = { kind: 'issue' | 'discard' | 'send'; invoice: Invoice } | { kind: 'cancel-payment'; payment: InvoicePayment; invoice: Invoice } | null;

const isOpen = (invoice: Invoice): boolean => invoice.kind === 'invoice' && (invoice.status === 'issued' || invoice.status === 'partially_paid');
const isEmitted = (invoice: Invoice): boolean => invoice.number !== null && invoice.status !== 'draft' && invoice.status !== 'discarded';

const sendDescription = (invoice: Invoice): string =>
  `${documentName(invoice)} est mise en file d’envoi, en pièce jointe (PDF), au contact principal du destinataire ; la remise n’est pas suivie.${invoice.sentAt ? ` Un envoi a déjà été demandé le ${formatDateFr(invoice.sentAt)} : un nouvel envoi est permis.` : ''} Limite : ${String(SEND_LIMIT_PER_INVOICE)} envois par heure pour une même facture, ${String(SEND_LIMIT_PER_ORGANIZATION)} pour l’organisation.`;

export interface InvoiceActions {
  actionsFor: (invoice: Invoice) => ActionItem[];
  cancelPaymentFor: (invoice: Invoice, payment: InvoicePayment) => void;
  dialogs: ReactNode;
}

export function useInvoiceActions({ redirectAfterDiscard = false }: { redirectAfterDiscard?: boolean } = {}): InvoiceActions {
  const permissions = useInvoicingPermissions();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const issue = useIssueInvoice();
  const discard = useDiscardDraft();
  const send = useSendInvoice();
  const cancelPayment = useCancelInvoicePayment();
  const pdf = useInvoicePdf();
  const [pending, setPending] = useState<Pending>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [crediting, setCrediting] = useState<string | null>(null);

  const fail = (title: string, error: unknown) => { notify({ tone: 'danger', title, description: errorMessage(error) }); };

  const confirmIssue = async (invoice: Invoice) => {
    setPending(null);
    try {
      const issued = await issue.mutateAsync(invoice.id);
      notify({ title: issued.replayed === true ? 'Facture déjà émise' : 'Facture émise', description: `${documentName(issued)}, ${moneyText(issued.totalGross)} TTC.` });
    } catch (error) {
      fail('Émission impossible', error);
    }
  };

  const confirmDiscard = async (invoice: Invoice) => {
    setPending(null);
    try {
      await discard.mutateAsync(invoice.id);
      notify({ title: 'Brouillon abandonné', description: 'Aucun numéro n’a été consommé.' });
      if (redirectAfterDiscard) push(invoicingPaths.invoices);
    } catch (error) {
      fail('Abandon impossible', error);
    }
  };

  const confirmSend = async (invoice: Invoice) => {
    setPending(null);
    try {
      await send.mutateAsync(invoice.id);
      notify({ title: 'Envoi demandé', description: `${documentName(invoice)} est mise en file d’envoi au contact principal du destinataire, PDF en pièce jointe. La remise n’est pas confirmée.` });
    } catch (error) {
      fail('Envoi impossible', error);
    }
  };

  const confirmCancelPayment = async (payment: InvoicePayment) => {
    setPending(null);
    try {
      await cancelPayment.mutateAsync(payment.id);
      notify({ title: 'Règlement annulé', description: `Le règlement de ${moneyText(payment.amount)} est contrepassé au grand livre.` });
    } catch (error) {
      fail('Annulation impossible', error);
    }
  };

  const download = async (invoice: Invoice) => {
    try {
      saveBlob(await pdf.mutateAsync(invoice.id), safeFilename(documentName(invoice)));
    } catch (error) {
      fail('Téléchargement impossible', error);
    }
  };

  const actionsFor = (invoice: Invoice): ActionItem[] => {
    const draft = invoice.status === 'draft';
    const items: (ActionItem | false)[] = [
      permissions.write && draft && { id: 'edit', label: 'Modifier le brouillon', icon: FilePenLine, onSelect: () => { push(invoicingPaths.editInvoice(invoice.id)); } },
      permissions.write && draft && { id: 'issue', label: 'Émettre la facture', icon: Send, onSelect: () => { setPending({ kind: 'issue', invoice }); } },
      permissions.write && isOpen(invoice) && (invoice.outstanding?.amount ?? 0) > 0 && { id: 'pay', label: 'Enregistrer un règlement', icon: Banknote, onSelect: () => { setPaying(invoice); } },
      permissions.credit && isOpen(invoice) && (invoice.outstanding?.amount ?? 0) > 0 && { id: 'credit', label: 'Émettre un avoir', icon: ReceiptText, onSelect: () => { setCrediting(invoice.id); } },
      isEmitted(invoice) && { id: 'pdf', label: 'Télécharger le PDF', icon: Download, onSelect: () => { void download(invoice); } },
      permissions.write && isEmitted(invoice) && { id: 'send', label: 'Envoyer par e-mail', icon: Mail, onSelect: () => { setPending({ kind: 'send', invoice }); } },
      permissions.write && draft && { id: 'discard', label: 'Abandonner le brouillon', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => { setPending({ kind: 'discard', invoice }); } },
    ];
    return items.filter((item): item is ActionItem => item !== false);
  };

  const target = pending?.invoice;
  const dialogs = (
    <>
      <ConfirmDialog
        open={pending?.kind === 'issue'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Émettre la facture ?"
        description="Le serveur recalcule les taxes, attribue le numéro suivant de la suite continue, produit le PDF et inscrit la facture au grand livre. Une facture émise ne se modifie plus : seul un avoir la corrige."
        confirmLabel="Émettre la facture"
        loading={issue.isPending}
        onConfirm={() => { if (target) void confirmIssue(target); }}
      />
      <ConfirmDialog
        open={pending?.kind === 'discard'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Abandonner le brouillon ?"
        description="Le brouillon n’aura pas de numéro et restera consultable parmi les brouillons abandonnés. Cette action ne peut pas être annulée."
        confirmLabel="Abandonner le brouillon"
        tone="danger"
        loading={discard.isPending}
        onConfirm={() => { if (target) void confirmDiscard(target); }}
      />
      <ConfirmDialog
        open={pending?.kind === 'send'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Envoyer par e-mail ?"
        description={target ? sendDescription(target) : ''}
        confirmLabel="Envoyer"
        loading={send.isPending}
        onConfirm={() => { if (target) void confirmSend(target); }}
      />
      <ConfirmDialog
        open={pending?.kind === 'cancel-payment'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Annuler ce règlement ?"
        description={pending?.kind === 'cancel-payment' ? `Le règlement de ${moneyText(pending.payment.amount)} du ${formatDateFr(pending.payment.paidOn)} sera contrepassé : le reste dû de la facture est recalculé.` : ''}
        confirmLabel="Annuler le règlement"
        tone="danger"
        loading={cancelPayment.isPending}
        onConfirm={() => { if (pending?.kind === 'cancel-payment') void confirmCancelPayment(pending.payment); }}
      />
      <PaymentDialog invoice={paying} onClose={() => { setPaying(null); }} />
      <CreditNoteDialog invoiceId={crediting} onClose={() => { setCrediting(null); }} />
    </>
  );

  return { actionsFor, cancelPaymentFor: (invoice, payment) => { setPending({ kind: 'cancel-payment', payment, invoice }); }, dialogs };
}
