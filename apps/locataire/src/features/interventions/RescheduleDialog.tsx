'use client';

import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useFlash } from '@/components/flash';
import { addDays, formatDate } from '@/lib/dates';
import { describeFailure } from '@/tenant/errors';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { SLOT_LABEL } from '@/tenant/interventionLabels';
import { useRequestReschedule } from '@/tenant/interventionQueries';
import { VISIT_SLOTS } from '@/tenant/interventionModel';
import type { InterventionVisit, TenantIntervention, VisitSlot } from '@/tenant/interventionModel';

const SLOT_OPTIONS = VISIT_SLOTS.map((slot) => ({ value: slot, label: SLOT_LABEL[slot] }));
const isSlot = (value: string): value is VisitSlot => VISIT_SLOTS.some((slot) => slot === value);

export function RescheduleDialog({
  intervention,
  visit,
  open,
  onOpenChange,
}: {
  intervention: TenantIntervention;
  visit: InterventionVisit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const show = useFlash((state) => state.show);
  const request = useRequestReschedule();
  const earliest = addDays(new Date().toISOString().slice(0, 10), 1);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<VisitSlot | ''>('');
  const [errors, setErrors] = useState<{ date?: string; slot?: string }>({});

  const submit = () => {
    const next: { date?: string; slot?: string } = {};
    if (date === '' || date < earliest) next.date = `Choisissez une date à partir du ${formatDate(earliest)}.`;
    if (slot === '') next.slot = 'Choisissez un créneau.';
    setErrors(next);
    if (next.date !== undefined || slot === '') return;
    request.mutate(
      { id: intervention.id, visitId: visit.id, requestedOn: date, slot },
      {
        onSuccess: () => {
          onOpenChange(false);
          show({ tone: 'success', title: 'Demande envoyée', detail: 'Votre gestionnaire vous répondra : le rendez-vous reste inchangé jusqu’à son accord.', path: `/interventions/${intervention.id}` });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Demander un autre créneau" description="Proposez une date : l’intervenant n’est pas joignable directement, votre gestionnaire confirme ou vous contre-propose.">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <TextField label="Date souhaitée" type="date" placeholder="JJ/MM/AAAA" min={earliest} value={date} onChange={(event) => { setDate(event.target.value); }} error={errors.date} data-autofocus />
          <Select
            label="Créneau"
            placeholder="Choisir un créneau"
            value={slot}
            options={SLOT_OPTIONS}
            onValueChange={(value) => { if (isSlot(value)) setSlot(value); }}
            error={errors.slot}
          />
          {request.isError ? (
            <p role="alert" className="text-body text-fg-danger">
              {describeFailure(request.error, INTERVENTION_WORDING).message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={request.isPending}>
              Envoyer la demande
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
