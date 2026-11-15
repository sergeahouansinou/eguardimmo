'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { CommandAlert, DateField } from '../parts';

export function ShiftDialog({
  open,
  count,
  today,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  count: number;
  today: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState<string | undefined>();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Modifier les lignes" description={`Nouvelle date d’échéance pour ${String(count)} ligne${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}.`} className="max-w-[440px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!date) {
              setMessage('Choisissez une date.');
              return;
            }
            setMessage(undefined);
            onSubmit(date);
          }}
        >
          <CommandAlert error={error} />
          <DateField label="Nouvelle échéance" value={date} error={message} onChange={setDate} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Appliquer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
