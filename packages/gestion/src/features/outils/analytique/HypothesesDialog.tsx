'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { z } from 'zod';
import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { pushFlash } from '../kit';
import { formatDecimal } from './format';
import { useUpdateAssumptions } from './source';
import type { Assumptions } from './source';

const percentField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} : saisissez un pourcentage.`)
    .regex(/^\d{1,2}([.,]\d{1,2})?$/, `${label} : format attendu 3,26 (deux décimales au plus).`)
    .transform((value) => Math.round(Number(value.replace(',', '.')) * 100))
    .pipe(z.number().max(1000, `${label} : 10 % au maximum.`));

export const hypothesesFormSchema = z.object({
  irl: percentField('Indexation IRL'),
  growth: percentField('Hausse annuelle des dépenses'),
});

const toField = (bp: number): string => formatDecimal(bp / 100, 2);

export interface HypothesesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Assumptions;
}

export function HypothesesDialog({ open, onOpenChange, current }: HypothesesDialogProps) {
  const [irl, setIrl] = useState(toField(current.irlBp));
  const [growth, setGrowth] = useState(toField(current.growthBp));
  const [errors, setErrors] = useState<{ irl?: string; growth?: string }>({});
  const mutation = useUpdateAssumptions();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const parsed = hypothesesFormSchema.safeParse({ irl, growth });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ irl: flat.irl?.[0], growth: flat.growth?.[0] });
      return;
    }
    setErrors({});
    mutation.mutate(
      { irlBp: parsed.data.irl, growthBp: parsed.data.growth },
      {
        onSuccess: () => {
          pushFlash('Hypothèses du prévisionnel mises à jour.');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Modifier les hypothèses"
        description="Ces taux recalculent immédiatement la projection de trésorerie."
        className="max-w-md"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-4">
          <TextField
            label="Indexation IRL (%)"
            placeholder="Ex. 3,26"
            inputMode="decimal"
            value={irl}
            error={errors.irl}
            onChange={(event) => { setIrl(event.target.value); }}
          />
          <TextField
            label="Hausse annuelle des dépenses (%)"
            placeholder="Ex. 2"
            inputMode="decimal"
            value={growth}
            error={errors.growth}
            onChange={(event) => { setGrowth(event.target.value); }}
          />
          {mutation.isError ? <p className="text-caption text-fg-danger">Les hypothèses n’ont pas pu être enregistrées. Réessayez.</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={mutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
