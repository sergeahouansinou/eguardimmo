'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { z } from 'zod';
import { dateText, fieldErrors, moneyText } from '../forms';
import { CommandAlert, DateField, MoneyField } from '../parts';

const KINDS = [
  { value: 'relance', label: 'Relance amiable' },
  { value: 'mise_en_demeure', label: 'Mise en demeure' },
  { value: 'commandement', label: 'Commandement de payer' },
  { value: 'autre', label: 'Autre acte' },
];

const schema = z.object({
  date: dateText('Date'),
  kind: z.enum(['relance', 'mise_en_demeure', 'commandement', 'autre']),
  libelle: z.string().trim().min(1, 'Décrivez l’acte.').max(160, 'Description trop longue.'),
  intervenant: z.string().trim().min(1, 'Indiquez l’intervenant.').max(120, 'Nom trop long.'),
  cout: moneyText('Coût', { allowZero: true }),
});
export type DiligenceValues = z.output<typeof schema>;

export function DiligenceDialog({
  open,
  today,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  today: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: DiligenceValues) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState('relance');
  const [libelle, setLibelle] = useState('');
  const [intervenant, setIntervenant] = useState('');
  const [cout, setCout] = useState('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Ajouter une diligence" description="L’acte est ajouté au carnet. Son coût peut être refacturé au locataire." className="max-w-[520px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = schema.safeParse({ date, kind, libelle, intervenant, cout });
            if (!parsed.success) {
              setErrors(fieldErrors(parsed.error));
              return;
            }
            setErrors({});
            onSubmit(parsed.data);
          }}
        >
          <CommandAlert error={error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateField label="Date de l’acte" value={date} error={errors.date} onChange={setDate} />
            <Select label="Type d’acte" placeholder="Choisir" options={KINDS} value={kind} onValueChange={setKind} />
          </div>
          <TextField label="Description" placeholder="Mise en demeure, recommandé AR" value={libelle} error={errors.libelle} onChange={(event) => { setLibelle(event.target.value); }} />
          <TextField label="Intervenant" placeholder="SCP Agbodjo, commissaire de justice" value={intervenant} error={errors.intervenant} onChange={(event) => { setIntervenant(event.target.value); }} />
          <MoneyField label="Coût, €" value={cout} placeholder="124,50" error={errors.cout} onChange={setCout} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Ajouter au carnet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
