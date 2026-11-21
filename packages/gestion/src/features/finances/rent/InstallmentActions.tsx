'use client';

import { ConfirmDialog } from '@eguardimmo/ui';
import { Ban, Banknote, Download, FileText, Receipt, Send } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ReasonDialog } from './ReasonDialog';
import { useCancelInstallment, useIssueNotice, useIssueReceipt, useNoticePdf, useReceiptPdf, useRentPermissions } from './hooks';
import { periodLabel } from './labels';
import type { RentInstallment } from './model';
import { rentPaths } from './paths';
import { safeFilename, saveBlob } from './download';
import { errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';

type Pending = { kind: 'issue' | 'cancel'; installment: RentInstallment } | null;

export function useInstallmentActions(): { actionsFor: (installment: RentInstallment) => ActionItem[]; dialogs: ReactNode } {
  const permissions = useRentPermissions();
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const issue = useIssueNotice();
  const cancel = useCancelInstallment();
  const issueReceipt = useIssueReceipt();
  const noticePdf = useNoticePdf();
  const receiptPdf = useReceiptPdf();
  const [pending, setPending] = useState<Pending>(null);

  const fail = (title: string, error: unknown) => { notify({ tone: 'danger', title, description: errorMessage(error) }); };

  const confirmIssue = async (installment: RentInstallment) => {
    setPending(null);
    try {
      const issued = await issue.mutateAsync(installment.id);
      notify({ title: 'Avis d’échéance émis', description: `Échéance de ${periodLabel(issued.periodStart, issued.periodEnd)}${issued.notice ? `, avis ${issued.notice.number}` : ''}.` });
    } catch (error) {
      fail('Émission impossible', error);
    }
  };

  const confirmCancel = async (installment: RentInstallment, reason: string) => {
    try {
      await cancel.mutateAsync({ id: installment.id, reason });
      setPending(null);
      notify({ title: 'Échéance annulée', description: `Échéance de ${periodLabel(installment.periodStart, installment.periodEnd)} annulée.` });
    } catch (error) {
      setPending(null);
      fail('Annulation impossible', error);
    }
  };

  const download = async (load: () => Promise<Blob>, filename: string, title: string) => {
    try {
      saveBlob(await load(), safeFilename(filename));
    } catch (error) {
      fail(title, error);
    }
  };

  const emitReceipt = async (installment: RentInstallment) => {
    try {
      const receipt = await issueReceipt.mutateAsync(installment.id);
      notify({ title: 'Quittance émise', description: `Quittance ${receipt.number}.` });
    } catch (error) {
      fail('Émission de la quittance impossible', error);
    }
  };

  const actionsFor = (installment: RentInstallment): ActionItem[] => {
    const open = installment.status === 'issued' || installment.status === 'partially_paid';
    const items: (ActionItem | false)[] = [
      permissions.recordPayment && open && { id: 'pay', label: 'Enregistrer un paiement', icon: Banknote, onSelect: () => { push(rentPaths.newPayment(installment.leaseId)); } },
      permissions.manage && installment.status === 'upcoming' && { id: 'issue', label: 'Émettre l’avis d’échéance', icon: Send, onSelect: () => { setPending({ kind: 'issue', installment }); } },
      installment.notice !== null && { id: 'notice-pdf', label: 'Télécharger l’avis (PDF)', icon: FileText, onSelect: () => { void download(() => noticePdf.mutateAsync(installment.id), `Avis-${installment.notice?.number ?? installment.id}`, 'Téléchargement impossible'); } },
      permissions.manage && installment.status === 'paid' && (installment.receiptState === 'pending' || installment.receiptState === 'on_demand') && { id: 'receipt', label: 'Émettre la quittance', icon: Receipt, onSelect: () => { void emitReceipt(installment); } },
      installment.receipt !== null && { id: 'receipt-pdf', label: 'Télécharger la quittance (PDF)', icon: Download, onSelect: () => { const receipt = installment.receipt; if (receipt) void download(() => receiptPdf.mutateAsync(receipt.id), `Quittance-${receipt.number}`, 'Téléchargement impossible'); } },
      permissions.manage && (installment.status === 'upcoming' || installment.status === 'issued') && { id: 'cancel', label: 'Annuler l’échéance', icon: Ban, tone: 'danger', separatorBefore: true, onSelect: () => { setPending({ kind: 'cancel', installment }); } },
    ];
    return items.filter((item): item is ActionItem => item !== false);
  };

  const target = pending?.installment;
  const dialogs = (
    <>
      <ConfirmDialog
        open={pending?.kind === 'issue'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Émettre l’avis d’échéance ?"
        description={target ? `L’avis de ${periodLabel(target.periodStart, target.periodEnd)} sera numéroté et l’appel de loyer sera inscrit au grand livre. Cette action ne peut pas être annulée autrement que par l’annulation de l’échéance.` : ''}
        confirmLabel="Émettre l’avis"
        loading={issue.isPending}
        onConfirm={() => { if (target) void confirmIssue(target); }}
      />
      <ReasonDialog
        open={pending?.kind === 'cancel'}
        title="Annuler l’échéance ?"
        description={target ? `L’échéance de ${periodLabel(target.periodStart, target.periodEnd)} ne sera plus appelée et la période ne sera pas régénérée.` : ''}
        confirmLabel="Annuler l’échéance"
        placeholder="Ex. Émise par erreur"
        loading={cancel.isPending}
        onConfirm={(reason) => { if (target) void confirmCancel(target, reason); }}
        onClose={() => { setPending(null); }}
      />
    </>
  );
  return { actionsFor, dialogs };
}
