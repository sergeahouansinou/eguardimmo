'use client';

import { Button, Dialog, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCommand } from '../hooks/useCommand';
import { useZodForm } from '../hooks/useZodForm';
import { REASON_LABELS } from '../lib/labels';
import { REASONS, readingFormSchema } from '../schemas/releves';
import type { Meter, Reading, Reason } from '../schemas/releves';
import { FilePicker } from './FilePicker';

const ORIGINS = ['Relevé du locataire', 'Relevé du propriétaire', 'Relevé du gardien', 'Télérelève', 'État des lieux'] as const;

export interface ReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meters: readonly Meter[];
  describe: (meter: Meter) => string;
  initialMeterId?: string;
  reading?: Reading;
}

function ReadingForm({ onOpenChange, meters, describe, initialMeterId, reading }: Omit<ReadingDialogProps, 'open'>) {
  const form = useZodForm(
    readingFormSchema,
    reading
      ? { meterId: reading.meterId, date: reading.date, index: String(reading.index).replace('.', ','), reason: reading.reason, origin: reading.origin }
      : { meterId: initialMeterId ?? '', date: '', index: '', reason: 'en_cours_de_bail', origin: ORIGINS[0] },
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const save = useCommand(
    (source, input: { meterId: string; date: string; index: number; reason: Reason; origin: string; hasPhoto: boolean }) =>
      reading ? source.updateReading(reading.id, input) : source.createReading(input),
    { success: () => (reading ? 'Relevé modifié' : 'Relevé enregistré'), onDone: () => { onOpenChange(false); } },
  );
  const meter = meters.find((item) => item.id === form.values.meterId);
  return (
    <form
      noValidate
      onSubmit={form.submit((values) => { save.execute({ ...values, hasPhoto: photo !== null }); })}
      className="flex flex-col gap-3 p-4"
    >
      <Select
        label="Compteur"
        placeholder="Choisir un compteur"
        searchable
        options={meters.map((item) => ({ value: item.id, label: describe(item) }))}
        value={form.values.meterId}
        onValueChange={(next) => { form.set('meterId', next); }}
        error={form.error('meterId') ? 'Choisissez un compteur' : undefined}
        disabled={reading !== undefined}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Date du relevé" type="date" placeholder="2026-11-12" {...form.field('date')} />
        <TextField label={`Index${meter ? `, ${meter.unit}` : ''}`} placeholder="9 650" inputMode="decimal" {...form.field('index')} />
        <Select
          label="Motif"
          placeholder="Choisir un motif"
          options={REASONS.map((entry) => ({ value: entry, label: REASON_LABELS[entry] }))}
          value={form.values.reason}
          onValueChange={(next) => {
            const reason = REASONS.find((entry) => entry === next);
            if (reason) form.set('reason', reason);
          }}
        />
        <Select
          label="Origine"
          placeholder="Choisir une origine"
          options={ORIGINS.map((entry) => ({ value: entry, label: entry }))}
          value={form.values.origin}
          onValueChange={(next) => { form.set('origin', next); }}
        />
      </div>
      <FilePicker label="Joindre une photo du compteur" hint="JPG ou PNG, 10 Mo au maximum, facultatif" accept={['image/jpeg', 'image/png', '.jpg', '.jpeg', '.png']} onPick={(files) => { setPhoto(files[0]?.name ?? null); }} />
      {photo ? <p className="text-body text-fg">{photo}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => { onOpenChange(false); }}>
          Annuler
        </Button>
        <Button type="submit" loading={save.isPending}>
          {reading ? 'Enregistrer les modifications' : 'Enregistrer le relevé'}
        </Button>
      </div>
    </form>
  );
}

export function ReadingDialog({ open, onOpenChange, ...rest }: ReadingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={rest.reading ? 'Modifier le relevé' : 'Nouveau relevé'} description="L’index doit être supérieur ou égal au relevé précédent.">
        <ReadingForm onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}
