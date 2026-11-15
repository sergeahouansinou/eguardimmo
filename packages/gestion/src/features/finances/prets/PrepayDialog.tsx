'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { moneyText } from '../forms';
import { CommandAlert, MoneyField } from '../parts';

export function PrepayDialog({
  open,
  label,
  restant,
  money,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  label: string;
  restant: number;
  money: (minor: number) => string;
  pending: boolean;
  error: Error | null;
  onSubmit: (montant: number) => void;
  onClose: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [message, setMessage] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Remboursement anticipé" description={`${label} : capital restant dû ${money(restant)}.`} className="max-w-[440px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = moneyText('Montant').safeParse(montant);
            if (!parsed.success) {
              setMessage(parsed.error.issues[0]?.message);
              return;
            }
            if (parsed.data > restant) {
              setMessage('Le remboursement dépasse le capital restant dû.');
              return;
            }
            setMessage(undefined);
            onSubmit(parsed.data);
          }}
        >
          <CommandAlert error={error} />
          <MoneyField label="Montant remboursé, €" value={montant} onChange={setMontant} error={message} placeholder="10000" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Enregistrer le remboursement
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
