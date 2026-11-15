'use client';

import { Button, Dialog, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { useMemo } from 'react';
import { useCommand } from '../../hooks/useCommand';
import { useZodForm } from '../../hooks/useZodForm';
import { toMajorInput } from '../../lib/amount';
import { inventaireFormSchema } from '../../schemas/releves';
import type { Inventaire, InventaireInput } from '../../schemas/releves';
import type { LotRow } from '../../schemas/lots';
import type { Currency } from '../../../../format/money';

export interface InventaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: Currency;
  lots: readonly LotRow[];
  templates: readonly string[];
  inventaire?: Inventaire;
}

function InventaireForm({ onOpenChange, currency, lots, templates, inventaire }: Omit<InventaireDialogProps, 'open'>) {
  const schema = useMemo(() => inventaireFormSchema(currency), [currency]);
  const form = useZodForm(
    schema,
    inventaire
      ? { lotId: inventaire.lotId, template: inventaire.template, tenant: inventaire.tenant ?? '', value: toMajorInput(inventaire.value, currency) }
      : { lotId: '', template: '', tenant: '', value: '' },
  );
  const save = useCommand(
    (source, input: InventaireInput) => (inventaire ? source.updateInventaire(inventaire.id, input).then(() => ({ id: inventaire.id })) : source.createInventaire(input)),
    {
      success: () => (inventaire ? 'Inventaire modifié' : 'Inventaire créé'),
      onDone: () => { onOpenChange(false); },
    },
  );
  const lot = lots.find((item) => item.id === form.values.lotId);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        form.submit((values) => { save.execute({ lotId: values.lotId, template: values.template, tenant: values.tenant === '' ? null : values.tenant, value: values.value }); })(event);
      }}
      className="flex flex-col gap-3 p-4"
    >
      <Select
        label="Bien"
        placeholder="Choisir un bien"
        searchable
        options={lots.filter((item) => !item.archived).map((item) => ({ value: item.id, label: item.name, description: item.immeubleName }))}
        value={form.values.lotId}
        onValueChange={(next) => { form.set('lotId', next); }}
        error={form.error('lotId') ? 'Choisissez un bien' : undefined}
      />
      <Select
        label="Modèle"
        placeholder="Choisir un modèle"
        options={templates.map((entry) => ({ value: entry, label: entry }))}
        value={form.values.template}
        onValueChange={(next) => { form.set('template', next); }}
        error={form.error('template') ? 'Choisissez un modèle' : undefined}
      />
      <TextField label="Locataire" placeholder={lot?.tenant?.name ?? 'Nom du locataire, facultatif'} hint="Par défaut, le locataire actuel du bien." {...form.field('tenant')} />
      <TextField label="Valeur du mobilier, €" placeholder="2350" inputMode="decimal" {...form.field('value')} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => { onOpenChange(false); }}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending}>
          {inventaire ? 'Enregistrer les modifications' : 'Créer l’inventaire'}
        </Button>
      </div>
    </form>
  );
}

export function InventaireDialog({ open, onOpenChange, ...rest }: InventaireDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={rest.inventaire ? `Modifier ${rest.inventaire.ref}` : 'Nouvel inventaire'} description="Le mobilier fourni sert de référence à la sortie du locataire.">
        <InventaireForm onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}
