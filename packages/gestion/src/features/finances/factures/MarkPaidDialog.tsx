'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { MODE_LABELS, options } from '../labels';
import { CommandAlert, DateField } from '../parts';
import { paymentModeSchema } from '../schemas';
import type { PaymentMode } from '../schemas';

export function MarkPaidDialog({
  open,
  numero,
  today,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  numero: string;
  today: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: { date: string; mode: PaymentMode }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<PaymentMode>('virement');
  const [message, setMessage] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Enregistrer un paiement" description={`Règlement de la facture ${numero}.`} className="max-w-[460px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!date || date > today) {
              setMessage('Choisissez une date qui n’est pas dans le futur.');
              return;
            }
            setMessage(undefined);
            onSubmit({ date, mode });
          }}
        >
          <CommandAlert error={error} />
          <DateField label="Date du paiement" value={date} error={message} onChange={setDate} />
          <Select label="Mode de paiement" placeholder="Choisir un mode" options={options(MODE_LABELS)} value={mode} onValueChange={(value) => { setMode(paymentModeSchema.parse(value)); }} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Marquer comme payée
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
