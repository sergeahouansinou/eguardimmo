'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { receiptCancelInputSchema } from './schemas';
import type { Receipt } from './schemas';

export function CancelReceiptDialog({
  receipt,
  tenantName,
  pending,
  onClose,
  onConfirm,
}: {
  receipt: Receipt | null;
  tenantName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (receipt: Receipt, reason: string) => void;
}) {
  return (
    <Dialog open={receipt !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        title="Annuler la quittance ?"
        description={receipt ? `${receipt.number ?? ''}, ${tenantName}. Le PDF d’origine reste consultable, marqué annulé, et l’échéance redevient à émettre.` : undefined}
      >
        {receipt ? <CancelForm key={receipt.id} receipt={receipt} pending={pending} onConfirm={onConfirm} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelForm({ receipt, pending, onConfirm }: { receipt: Receipt; pending: boolean; onConfirm: (receipt: Receipt, reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const parsed = receiptCancelInputSchema.safeParse({ reason });
  const error = attempted && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  return (
    <div className="flex flex-col gap-3 p-4">
      <Textarea
        label="Motif de l’annulation *"
        placeholder="Ex. Montant erroné, quittance émise au mauvais locataire"
        rows={3}
        value={reason}
        error={error}
        data-autofocus
        onChange={(event) => { setReason(event.target.value); }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Conserver la quittance</Button>
        </DialogClose>
        <Button
          variant="danger"
          loading={pending}
          onClick={() => {
            setAttempted(true);
            if (parsed.success) onConfirm(receipt, parsed.data.reason);
          }}
        >
          Annuler la quittance
        </Button>
      </div>
    </div>
  );
}
