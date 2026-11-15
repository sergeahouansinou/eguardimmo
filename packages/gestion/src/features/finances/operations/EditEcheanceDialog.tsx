'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { dateText, fieldErrors, moneyText } from '../forms';
import { formatMoneyInput } from '../money';
import type { Echeance } from '../schemas';
import { z } from 'zod';
import { CommandAlert, DateField, MoneyField } from '../parts';
import { TextField } from '@eguardimmo/ui';

const schema = z.object({ libelle: z.string().trim().min(1, 'Le libellé est obligatoire.').max(120), montant: moneyText('Montant'), echeance: dateText('Échéance') });

export function EditEcheanceDialog({
  echeance,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  echeance: Echeance | null;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: { libelle: string; montant: number; echeance: string }) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={echeance !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Modifier l’échéance" description="Le montant et la date sont recalculés sur l’avis d’échéance." className="max-w-[480px]">
        {echeance ? <EditForm key={echeance.id} echeance={echeance} pending={pending} error={error} onSubmit={onSubmit} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ echeance, pending, error, onSubmit }: { echeance: Echeance; pending: boolean; error: Error | null; onSubmit: (values: { libelle: string; montant: number; echeance: string }) => void }) {
  const [libelle, setLibelle] = useState(echeance.libelle);
  const [montant, setMontant] = useState(formatMoneyInput(echeance.montant));
  const [date, setDate] = useState(echeance.echeance);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const parsed = schema.safeParse({ libelle, montant, echeance: date });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };
  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <CommandAlert error={error} />
      <TextField label="Libellé *" data-autofocus placeholder="Loyer novembre 2026" value={libelle} error={errors.libelle} onChange={(event) => { setLibelle(event.target.value); }} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MoneyField label="Montant, €" value={montant} error={errors.montant} onChange={setMontant} />
        <DateField label="Échéance" value={date} error={errors.echeance} onChange={setDate} />
      </div>
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
