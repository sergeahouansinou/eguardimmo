'use client';

import { ConfirmDialog } from '@eguardimmo/ui';
import { useOpenCase } from './hooks';
import { moneyText } from '../rent/labels';
import { recoveryPaths } from './paths';
import type { Selection } from './selection';
import { errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../../locataires/kit';

export function OpenCaseDialog({ open, selection, onClose, onOpened }: { open: boolean; selection: Selection; onClose: () => void; onOpened: () => void }) {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const openCase = useOpenCase();

  const count = selection.ok ? selection.installmentIds.length + selection.invoiceIds.length : 0;

  const confirm = async () => {
    if (!selection.ok) {
      onClose();
      return;
    }
    try {
      const opened = await openCase.mutateAsync({ leaseId: selection.leaseId, debtorPartyId: selection.partyId, installmentIds: selection.installmentIds, invoiceIds: selection.invoiceIds });
      onOpened();
      noticeAfterNavigation({ title: 'Dossier ouvert', description: `Dossier ${opened.number} ouvert avec ${String(opened.itemsCount)} créance${opened.itemsCount > 1 ? 's' : ''}.` });
      push(recoveryPaths.case(opened.id));
    } catch (error) {
      onClose();
      notify({ tone: 'danger', title: 'Ouverture impossible', description: errorMessage(error) });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Ouvrir un dossier de recouvrement ?"
      description={
        selection.ok ? (
          <span className="flex flex-col gap-2">
            <span>{`Dossier pour ${selection.partyName ?? 'le locataire'}${selection.leaseReference ? `, bail ${selection.leaseReference}` : ''} : ${String(count)} créance${count > 1 ? 's' : ''}, ${moneyText(selection.total)} restant dû au grand livre.`}</span>
            <span>Les créances restent dans ce dossier jusqu’à leur retrait ou sa clôture ; un dossier actif est unique par bail et locataire.</span>
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <strong>Sélection invalide</strong>
            <span>{selection.reason}</span>
          </span>
        )
      }
      confirmLabel={selection.ok ? 'Ouvrir le dossier' : 'Compris'}
      loading={openCase.isPending}
      onConfirm={() => { void confirm(); }}
    />
  );
}
