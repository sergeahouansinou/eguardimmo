'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { addDays } from '../dates';
import { CommandAlert, DateField } from '../parts';

export function BillFeesDialog({
  open,
  today,
  amount,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  today: string;
  amount: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (echeance: string) => void;
  onClose: () => void;
}) {
  const [echeance, setEcheance] = useState(addDays(today, 15));
  const [message, setMessage] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Facturer les frais au locataire" description={`Une facture numérotée de ${amount} est émise pour les actes non encore refacturés.`} className="max-w-[460px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (echeance < today) {
              setMessage('L’échéance ne peut pas être passée.');
              return;
            }
            setMessage(undefined);
            onSubmit(echeance);
          }}
        >
          <CommandAlert error={error} />
          <DateField label="À payer avant le" value={echeance} error={message} onChange={setEcheance} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Émettre la facture
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
