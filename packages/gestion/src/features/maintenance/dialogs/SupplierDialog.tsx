'use client';

import { Checkbox, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useMaintenanceMutation, useNatureTerms, usePartyChoices } from '../hooks';
import type { Supplier } from '../model';
import { FormDialog, useSubmission } from './common';

export function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const save = useMaintenanceMutation((source, input: Parameters<typeof source.saveSupplier>[0]) => source.saveSupplier(input));
  const parties = usePartyChoices(supplier === null);
  const natures = useNatureTerms();
  const submission = useSubmission();
  const [partyId, setPartyId] = useState('');
  const [tradeTermIds, setTradeTermIds] = useState<string[]>(supplier?.tradeTermIds ?? []);
  const [preferred, setPreferred] = useState(supplier?.preferred ?? false);
  const [paymentTermsDays, setPaymentTermsDays] = useState(supplier?.paymentTermsDays === null || supplier === null ? '' : String(supplier.paymentTermsDays));
  const [internalNote, setInternalNote] = useState(supplier?.internalNote ?? '');
  const toggle = (id: string, checked: boolean) => { setTradeTermIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id))); };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={supplier ? `Modifier ${supplier.name ?? 'le prestataire'}` : 'Ajouter un prestataire'}
      description="Le prestataire est une société ou une personne déjà enregistrée dans vos tiers."
      submitLabel={supplier ? 'Enregistrer' : 'Ajouter'}
      submission={submission}
      onSubmit={() => {
        void submission.run(
          () => save.mutateAsync({ partyId: supplier ? null : partyId, supplierId: supplier?.id ?? null, tradeTermIds, preferred, paymentTermsDays, internalNote }),
          { title: supplier ? 'Prestataire modifié' : 'Prestataire ajouté' },
          onClose,
        );
      }}
    >
      {supplier === null ? (
        <Select label="Société ou personne *" placeholder="Choisir un tiers" searchable searchPlaceholder="Rechercher un tiers" value={partyId} onValueChange={setPartyId} options={(parties.data ?? []).map((party) => ({ value: party.id, label: party.name }))} />
      ) : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="text-caption text-fg-muted">Métiers</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {(natures.data ?? []).map((term) => (
            <Checkbox key={term.id} label={term.label} checked={tradeTermIds.includes(term.id)} onChange={(event) => { toggle(term.id, event.target.checked); }} />
          ))}
        </div>
      </fieldset>
      <Checkbox label="Prestataire préféré" checked={preferred} onChange={(event) => { setPreferred(event.target.checked); }} />
      <TextField label="Délai de règlement (jours)" placeholder="Ex. 30" inputMode="numeric" maxLength={3} value={paymentTermsDays} onChange={(event) => { setPaymentTermsDays(event.target.value); }} />
      <Textarea label="Note interne" placeholder="Visible de l’équipe uniquement" maxLength={500} rows={2} value={internalNote} onChange={(event) => { setInternalNote(event.target.value); }} />
    </FormDialog>
  );
}
