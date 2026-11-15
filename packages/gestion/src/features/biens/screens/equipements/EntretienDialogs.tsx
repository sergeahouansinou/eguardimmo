'use client';

import { Button, Dialog, DialogContent, TextField } from '@eguardimmo/ui';
import { useMemo } from 'react';
import { useCommand } from '../../hooks/useCommand';
import { useZodForm } from '../../hooks/useZodForm';
import { logEntryFormSchema, operationFormSchema } from '../../schemas/equipements';
import type { LogEntryInput, OperationInput } from '../../source';
import type { Currency } from '../../../../format/money';

interface DialogProps {
  equipementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogEntryDialog({ equipementId, currency, asOf, open, onOpenChange }: DialogProps & { currency: Currency; asOf: string }) {
  const schema = useMemo(() => logEntryFormSchema(currency), [currency]);
  const blank = { title: '', date: asOf, detail: '', cost: '' };
  const form = useZodForm(schema, blank);
  const add = useCommand((source, input: LogEntryInput) => source.addLogEntry(equipementId, input), {
    success: (_result, input) => `« ${input.title} » ajouté au carnet`,
    onDone: () => {
      form.reset(blank);
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ajouter une entrée au carnet" description="Une date passée est enregistrée comme faite, une date à venir comme planifiée.">
        <form
          noValidate
          onSubmit={(event) => {
            event.stopPropagation();
            form.submit((values) => { add.execute(values); })(event);
          }}
          className="flex flex-col gap-3 p-4"
        >
          <TextField label="Intitulé" placeholder="Recharge de gaz" {...form.field('title')} />
          <TextField label="Date" type="date" placeholder="2026-11-13" {...form.field('date')} />
          <TextField label="Détail" placeholder="Clim Services 75, photo jointe" {...form.field('detail')} />
          <TextField label="Coût, €" placeholder="95" inputMode="decimal" {...form.field('cost')} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button type="submit" loading={add.isPending}>
              Ajouter l’entrée
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OperationDialog({ equipementId, asOf, open, onOpenChange }: DialogProps & { asOf: string }) {
  const schema = useMemo(() => operationFormSchema(asOf), [asOf]);
  const blank = { label: '', doneBy: '', periodicityMonths: '12', lastOn: '' };
  const form = useZodForm(schema, blank);
  const add = useCommand((source, input: OperationInput) => source.addOperation(equipementId, input), {
    success: (_result, input) => `Opération « ${input.label} » ajoutée au plan`,
    onDone: () => {
      form.reset(blank);
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ajouter une opération" description="La prochaine échéance est calculée à partir de la dernière réalisation.">
        <form
          noValidate
          onSubmit={(event) => {
            event.stopPropagation();
            form.submit((values) => { add.execute(values); })(event);
          }}
          className="flex flex-col gap-3 p-4"
        >
          <TextField label="Opération" placeholder="Contrôle des fixations" {...form.field('label')} />
          <TextField label="Réalisée par" placeholder="Clim Services 75" {...form.field('doneBy')} />
          <TextField label="Périodicité, en mois" placeholder="12" inputMode="numeric" {...form.field('periodicityMonths')} />
          <TextField label="Dernière réalisation" type="date" placeholder="2026-05-20" {...form.field('lastOn')} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button type="submit" loading={add.isPending}>
              Ajouter l’opération
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
