'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { instalments } from '../derive';
import { CommandAlert, DateField } from '../parts';

const COUNTS = [2, 3, 4, 6, 9, 12];

export function PlanDialog({
  open,
  reste,
  today,
  money,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  reste: number;
  today: string;
  money: (minor: number) => string;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: { count: number; premiere: string }) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState('3');
  const [premiere, setPremiere] = useState(today);
  const [message, setMessage] = useState<string | undefined>();
  const parsedCount = Number(count);
  const preview = reste >= parsedCount && premiere >= today ? instalments(reste, parsedCount, premiere) : [];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Proposer un échéancier" description={`Reste dû à étaler : ${money(reste)}. Le locataire reçoit la proposition par e-mail.`} className="max-w-[480px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (premiere < today) {
              setMessage('La première échéance ne peut pas être passée.');
              return;
            }
            setMessage(undefined);
            onSubmit({ count: parsedCount, premiere });
          }}
        >
          <CommandAlert error={error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Nombre de versements" placeholder="Choisir" options={COUNTS.map((value) => ({ value: String(value), label: `${String(value)} versements` }))} value={count} onValueChange={setCount} />
            <DateField label="Premier versement" value={premiere} error={message} onChange={setPremiere} />
          </div>
          {preview.length > 0 ? (
            <ol aria-label="Aperçu de l’échéancier" className="flex flex-col rounded-md border border-line text-body">
              {preview.map((line, index) => (
                <li key={line.date} className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 first:border-t-0">
                  <span className="text-fg-muted">
                    {index + 1}. {formatDate(line.date)}
                  </span>
                  <b className="text-fg">{money(line.montant)}</b>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Proposer l’échéancier
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
