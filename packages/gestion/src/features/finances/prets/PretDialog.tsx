'use client';

import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { z } from 'zod';
import { fieldErrors, moneyText } from '../forms';
import { formatMoneyInput } from '../money';
import { CommandAlert, MoneyField } from '../parts';
import type { Pret } from '../schemas';
import { formatRate, parseRate } from './schedule';

const schema = z.object({
  bien: z.string().trim().min(1, 'Choisissez le bien financé.'),
  banque: z.string().trim().min(1, 'Indiquez la banque.').max(80, 'Nom trop long.'),
  emprunte: moneyText('Montant emprunté'),
  taux: z.string().transform((text, ctx) => {
    const value = parseRate(text);
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: 'Taux invalide (ex. 1,45).' });
      return z.NEVER;
    }
    return value;
  }),
  fin: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Fin du prêt : mois invalide (ex. 2041-06).'),
  mensualite: moneyText('Mensualité', { allowZero: true }),
  restantDu: moneyText('Capital restant dû', { allowZero: true }),
  interetsAnnee: moneyText('Intérêts de l’année', { allowZero: true }),
});
export type PretValues = z.output<typeof schema>;

export function PretDialog({
  pret,
  open,
  biens,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  pret: Pret | null;
  open: boolean;
  biens: readonly string[];
  pending: boolean;
  error: Error | null;
  onSubmit: (values: PretValues) => void;
  onClose: () => void;
}) {
  const [bien, setBien] = useState(pret?.bien ?? '');
  const [banque, setBanque] = useState(pret?.banque ?? '');
  const [emprunte, setEmprunte] = useState(pret ? formatMoneyInput(pret.emprunte) : '');
  const [taux, setTaux] = useState(pret ? formatRate(pret.tauxBp) : '');
  const [fin, setFin] = useState(pret?.fin ?? '');
  const [mensualite, setMensualite] = useState(pret ? formatMoneyInput(pret.mensualite) : '');
  const [restantDu, setRestantDu] = useState(pret ? formatMoneyInput(pret.restantDu) : '');
  const [interets, setInterets] = useState(pret ? formatMoneyInput(pret.interetsAnnee) : '0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title={pret ? 'Modifier le prêt' : 'Nouveau prêt'} description="Les intérêts payés alimentent le bilan et la déclaration annuelle." className="max-w-[560px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = schema.safeParse({ bien, banque, emprunte, taux, fin, mensualite, restantDu, interetsAnnee: interets });
            if (!parsed.success) {
              setErrors(fieldErrors(parsed.error));
              return;
            }
            if (parsed.data.restantDu > parsed.data.emprunte) {
              setErrors({ restantDu: 'Le capital restant dû dépasse le montant emprunté.' });
              return;
            }
            setErrors({});
            onSubmit(parsed.data);
          }}
        >
          <CommandAlert error={error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Bien *" placeholder="Choisir un bien" options={biens.map((value) => ({ value, label: value }))} value={bien} onValueChange={setBien} error={errors.bien} />
            <TextField label="Banque *" placeholder="Crédit du Littoral" value={banque} error={errors.banque} onChange={(event) => { setBanque(event.target.value); }} />
            <MoneyField label="Montant emprunté, € *" value={emprunte} onChange={setEmprunte} error={errors.emprunte} placeholder="180000" />
            <TextField label="Taux, %" inputMode="decimal" placeholder="1,45" value={taux} error={errors.taux} onChange={(event) => { setTaux(event.target.value); }} />
            <TextField label="Fin du prêt *" type="month" placeholder="2041-06" value={fin} error={errors.fin} onChange={(event) => { setFin(event.target.value); }} />
            <MoneyField label="Mensualité, €" value={mensualite} onChange={setMensualite} error={errors.mensualite} placeholder="1012" />
            <MoneyField label="Capital restant dû, € *" value={restantDu} onChange={setRestantDu} error={errors.restantDu} placeholder="132880" />
            <MoneyField label="Intérêts payés cette année, €" value={interets} onChange={setInterets} error={errors.interetsAnnee} placeholder="2918" />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {pret ? 'Enregistrer' : 'Ajouter le prêt'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
