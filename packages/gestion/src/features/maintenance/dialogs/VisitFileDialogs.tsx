'use client';

import { Checkbox, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useMaintenanceMutation } from '../hooks';
import { fileKindLabel, slotLabel } from '../labels';
import { FILE_KINDS, VISIT_SLOTS } from '../model';
import type { FileKind, VisitSlot } from '../model';
import { AttachmentField, validateAttachment } from './attachment';
import { FormDialog, useSubmission } from './common';
import type { DialogProps } from './common';
import { todayIso } from '../../locataires/kit/dates';

const slotOptions = VISIT_SLOTS.map((value) => ({ value, label: slotLabel[value] }));
const kindOptions = FILE_KINDS.map((value) => ({ value, label: fileKindLabel[value] }));
const isSlot = (value: string): value is VisitSlot => VISIT_SLOTS.some((candidate) => candidate === value);
const isKind = (value: string): value is FileKind => FILE_KINDS.some((candidate) => candidate === value);

export function VisitDialog({ intervention, onClose }: DialogProps) {
  const add = useMaintenanceMutation((source, input: Parameters<typeof source.addVisit>[1]) => source.addVisit(intervention.id, input));
  const submission = useSubmission();
  const today = todayIso();
  const [scheduledOn, setScheduledOn] = useState('');
  const [slot, setSlot] = useState<VisitSlot>('morning');
  const [presenceRequired, setPresenceRequired] = useState(true);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Proposer une visite"
      description="Le locataire confirme la visite ou demande un autre créneau."
      submitLabel="Proposer la visite"
      submission={submission}
      onSubmit={() => {
        void submission.run(() => add.mutateAsync({ scheduledOn, slot, presenceRequired, contactName, contactPhone }), { title: 'Visite proposée' }, onClose);
      }}
    >
      <TextField label="Date *" type="date" placeholder="AAAA-MM-JJ" min={today} value={scheduledOn} onChange={(event) => { setScheduledOn(event.target.value); }} />
      <Select label="Créneau *" placeholder="Choisir" value={slot} onValueChange={(value) => { if (isSlot(value)) setSlot(value); }} options={slotOptions} />
      <Checkbox label="Présence du locataire requise" checked={presenceRequired} onChange={(event) => { setPresenceRequired(event.target.checked); }} />
      <TextField label="Contact sur place" placeholder="Nom" maxLength={120} value={contactName} onChange={(event) => { setContactName(event.target.value); }} />
      <TextField label="Téléphone du contact" placeholder="Ex. 06 12 34 56 78" inputMode="tel" maxLength={32} value={contactPhone} onChange={(event) => { setContactPhone(event.target.value); }} />
    </FormDialog>
  );
}

export function FileDialog({ intervention, onClose }: DialogProps) {
  const upload = useMaintenanceMutation((source, input: Parameters<typeof source.uploadFile>[1]) => source.uploadFile(intervention.id, input));
  const submission = useSubmission();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<FileKind>('other');
  const [visibleToOwner, setVisibleToOwner] = useState(false);
  const [visibleToTenant, setVisibleToTenant] = useState(false);
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Ajouter une pièce"
      description="Choisissez qui peut voir cette pièce : par défaut, elle reste interne à l’agence."
      submitLabel="Ajouter la pièce"
      submission={submission}
      onSubmit={() => {
        if (file === null) { submission.fail('Choisissez un fichier.'); return; }
        const refusal = validateAttachment(file);
        if (refusal !== null) { submission.fail(refusal); return; }
        void submission.run(() => upload.mutateAsync({ file, kind, visibleToOwner, visibleToTenant }), { title: 'Pièce ajoutée' }, onClose);
      }}
    >
      <AttachmentField label="Fichier *" hint="PDF, JPEG ou PNG, 10 Mo au plus" file={file} onFile={setFile} />
      <Select label="Type de pièce *" placeholder="Choisir" value={kind} onValueChange={(value) => { if (isKind(value)) setKind(value); }} options={kindOptions} />
      <Checkbox label="Visible par le mandant" checked={visibleToOwner} onChange={(event) => { setVisibleToOwner(event.target.checked); }} />
      <Checkbox label="Visible par le locataire" checked={visibleToTenant} onChange={(event) => { setVisibleToTenant(event.target.checked); }} />
    </FormDialog>
  );
}
