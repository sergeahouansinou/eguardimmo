'use client';

import { useNotify } from '../../locataires/kit';
import { ConfirmAction } from '../shared/parts/ConfirmAction';
import { useRemindLease } from './hooks';

export function RemindConfirm({ leaseId, open, onClose }: { leaseId: string; open: boolean; onClose: () => void }) {
  const remind = useRemindLease();
  const notify = useNotify();
  return (
    <ConfirmAction
      open={open}
      title="Relancer les locataires de ce bail ?"
      description="Une notification leur demande de déposer leur attestation d’assurance. Une seule relance est possible par période de 7 jours et par bail. Ce n’est pas une mise en demeure : elle n’a aucune valeur juridique."
      confirmLabel="Envoyer la relance"
      failureTitle="Relance non envoyée"
      run={async () => {
        await remind.mutateAsync(leaseId);
        notify({ title: 'Relance envoyée', description: 'Les locataires du bail sont notifiés.' });
      }}
      onClose={onClose}
    />
  );
}
