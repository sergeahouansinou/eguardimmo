'use client';

import { ConfirmDialog, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { amountHint } from '../amounts';
import { useMaintenanceMutation, useNatureTerms, usePartyChoices } from '../hooks';
import { declineReasonLabel, responsibilityLabel } from '../labels';
import { DECLINE_REASONS, PRIORITIES, RESPONSIBILITIES } from '../model';
import type { Currency, DeclineReason, Priority, Responsibility } from '../model';
import { FormDialog, useSubmission } from './common';
import type { DialogProps } from './common';
import { priorityBadge } from '../labels';
import { todayIso } from '../../locataires/kit/dates';

const priorityOptions = PRIORITIES.map((value) => ({ value, label: priorityBadge[value].label }));
const responsibilityOptions = RESPONSIBILITIES.map((value) => ({ value, label: responsibilityLabel[value] }));
const declineOptions = DECLINE_REASONS.map((value) => ({ value, label: declineReasonLabel[value] }));
const isPriority = (value: string): value is Priority => PRIORITIES.some((candidate) => candidate === value);
const isResponsibility = (value: string): value is Responsibility => RESPONSIBILITIES.some((candidate) => candidate === value);
const isDeclineReason = (value: string): value is DeclineReason => DECLINE_REASONS.some((candidate) => candidate === value);

export function QualifyDialog({ intervention, onClose, currency }: DialogProps & { currency: Currency }) {
  const qualify = useMaintenanceMutation((source, input: Parameters<typeof source.qualify>[1]) => source.qualify(intervention.id, input));
  const natures = useNatureTerms();
  const submission = useSubmission();
  const [priority, setPriority] = useState<Priority>(intervention.priority);
  const [responsibility, setResponsibility] = useState<Responsibility>(intervention.responsibility);
  const [natureTermId, setNatureTermId] = useState(intervention.natureTermId);
  const [dueOn, setDueOn] = useState(intervention.dueOn ?? '');
  const [estimate, setEstimate] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Qualifier l’intervention"
      description="Fixez la nature, la priorité et la responsabilité avant de chercher un prestataire."
      submitLabel="Qualifier"
      submission={submission}
      onSubmit={() => {
        void submission.run(
          () => qualify.mutateAsync({ lockVersion: intervention.lockVersion, priority, responsibility, natureTermId, dueOn, estimatedAmount: estimate, currency }),
          { title: 'Intervention qualifiée' },
          onClose,
        );
      }}
    >
      <Select label="Nature *" placeholder="Choisir une nature" value={natureTermId} onValueChange={setNatureTermId} options={(natures.data ?? []).map((term) => ({ value: term.id, label: term.label }))} />
      <Select label="Priorité *" placeholder="Choisir une priorité" value={priority} onValueChange={(value) => { if (isPriority(value)) setPriority(value); }} options={priorityOptions} />
      <Select label="Responsabilité *" placeholder="Choisir" value={responsibility} onValueChange={(value) => { if (isResponsibility(value)) setResponsibility(value); }} options={responsibilityOptions} />
      <TextField label="Échéance" type="date" placeholder="AAAA-MM-JJ" min="2000-01-01" value={dueOn} onChange={(event) => { setDueOn(event.target.value); }} />
      <TextField label="Estimation hors engagement" placeholder={amountHint(currency)} inputMode="decimal" value={estimate} onChange={(event) => { setEstimate(event.target.value); }} />
    </FormDialog>
  );
}

export function DeclineDialog({ intervention, onClose }: DialogProps) {
  const decline = useMaintenanceMutation((source, input: Parameters<typeof source.decline>[1]) => source.decline(intervention.id, input));
  const submission = useSubmission();
  const [reason, setReason] = useState<DeclineReason>('other');
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Classer sans suite"
      description="Le locataire est informé du motif. Cette décision est définitive."
      submitLabel="Classer sans suite"
      tone="danger"
      submission={submission}
      onSubmit={() => {
        void submission.run(() => decline.mutateAsync({ lockVersion: intervention.lockVersion, reason, note }), { title: 'Intervention classée sans suite' }, onClose);
      }}
    >
      <Select label="Motif *" placeholder="Choisir un motif" value={reason} onValueChange={(value) => { if (isDeclineReason(value)) setReason(value); }} options={declineOptions} />
      <Textarea label="Explication *" placeholder="Expliquez la décision au locataire" maxLength={500} rows={3} value={note} onChange={(event) => { setNote(event.target.value); }} />
    </FormDialog>
  );
}

export function CancelDialog({ intervention, onClose }: DialogProps) {
  const cancel = useMaintenanceMutation((source, lockVersion: number) => source.cancel(intervention.id, lockVersion));
  const submission = useSubmission();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Annuler l’intervention ?"
      description={submission.failure ?? 'L’intervention est annulée définitivement ; les visites prévues sont annulées.'}
      confirmLabel="Annuler l’intervention"
      cancelLabel="Retour"
      tone="danger"
      loading={submission.pending}
      onConfirm={() => { void submission.run(() => cancel.mutateAsync(intervention.lockVersion), { title: 'Intervention annulée' }, onClose); }}
    />
  );
}

export function AssignDialog({ intervention, onClose }: DialogProps) {
  const assign = useMaintenanceMutation((source, input: { lockVersion: number; supplierPartyId: string }) => source.assign(intervention.id, input.lockVersion, input.supplierPartyId));
  const parties = usePartyChoices();
  const submission = useSubmission();
  const [supplierPartyId, setSupplierPartyId] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Assigner un prestataire"
      description="Le prestataire doit être actif et assuré pour être assigné."
      submitLabel="Assigner"
      submission={submission}
      onSubmit={() => {
        if (supplierPartyId === '') { submission.fail('Choisissez un prestataire.'); return; }
        void submission.run(() => assign.mutateAsync({ lockVersion: intervention.lockVersion, supplierPartyId }), { title: 'Prestataire assigné' }, onClose);
      }}
    >
      <Select label="Prestataire *" placeholder="Choisir un prestataire" searchable searchPlaceholder="Rechercher un prestataire" value={supplierPartyId} onValueChange={setSupplierPartyId} options={(parties.data ?? []).map((party) => ({ value: party.id, label: party.name }))} />
    </FormDialog>
  );
}

export function EngageDialog({ intervention, onClose }: DialogProps) {
  const engage = useMaintenanceMutation((source, input: Parameters<typeof source.engage>[1]) => source.engage(intervention.id, input));
  const submission = useSubmission();
  const [basis, setBasis] = useState<'under_ceiling' | 'emergency'>('under_ceiling');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Engager les travaux"
      description="Sous le plafond du mandat, ou en urgence avec un motif tracé au journal."
      submitLabel="Engager"
      submission={submission}
      onSubmit={() => {
        void submission.run(() => engage.mutateAsync({ lockVersion: intervention.lockVersion, basis, reason }), { title: 'Travaux engagés' }, onClose);
      }}
    >
      <Select
        label="Base de l’engagement *"
        placeholder="Choisir"
        value={basis}
        onValueChange={(value) => { if (value === 'under_ceiling' || value === 'emergency') setBasis(value); }}
        options={[{ value: 'under_ceiling', label: 'Sous le plafond du mandat' }, { value: 'emergency', label: 'Urgence (sans accord préalable)' }]}
      />
      {basis === 'emergency' ? <Textarea label="Motif de l’urgence *" placeholder="Ex. dégât des eaux en cours" maxLength={500} rows={3} value={reason} onChange={(event) => { setReason(event.target.value); }} /> : null}
    </FormDialog>
  );
}

export function CompleteDialog({ intervention, onClose }: DialogProps) {
  const complete = useMaintenanceMutation((source, input: Parameters<typeof source.complete>[1]) => source.complete(intervention.id, input));
  const submission = useSubmission();
  const today = todayIso();
  const [completedOn, setCompletedOn] = useState(today);
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Marquer les travaux terminés"
      description="Le locataire voit l’intervention comme terminée."
      submitLabel="Terminer"
      submission={submission}
      onSubmit={() => {
        void submission.run(() => complete.mutateAsync({ lockVersion: intervention.lockVersion, completedOn, note }), { title: 'Travaux terminés' }, onClose);
      }}
    >
      <TextField label="Date de fin *" type="date" placeholder="AAAA-MM-JJ" max={today} min={intervention.reportedOn} value={completedOn} onChange={(event) => { setCompletedOn(event.target.value); }} />
      <Textarea label="Compte rendu *" placeholder="Ce qui a été fait" maxLength={1000} rows={3} value={note} onChange={(event) => { setNote(event.target.value); }} />
    </FormDialog>
  );
}

export function CloseDialog({ intervention, onClose }: DialogProps) {
  const close = useMaintenanceMutation((source, input: { lockVersion: number; reason: string }) => source.close(intervention.id, input.lockVersion, input.reason));
  const submission = useSubmission();
  const [reason, setReason] = useState('');
  const needsReason = intervention.invoices.every((invoice) => invoice.status === 'cancelled');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Clôturer l’intervention"
      description={needsReason ? 'Aucune facture reçue : un motif est obligatoire.' : 'Toutes les factures reçues doivent être imputées.'}
      submitLabel="Clôturer"
      submission={submission}
      onSubmit={() => {
        void submission.run(() => close.mutateAsync({ lockVersion: intervention.lockVersion, reason }), { title: 'Intervention clôturée' }, onClose);
      }}
    >
      {needsReason ? <Textarea label="Motif sans facture *" placeholder="Ex. geste commercial du prestataire" maxLength={300} rows={2} value={reason} onChange={(event) => { setReason(event.target.value); }} /> : null}
    </FormDialog>
  );
}

export function ReopenDialog({ intervention, onClose }: DialogProps) {
  const reopen = useMaintenanceMutation((source, lockVersion: number) => source.reopen(intervention.id, lockVersion));
  const submission = useSubmission();
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Rouvrir l’intervention ?"
      description={submission.failure ?? 'L’intervention repasse en cours ; une facture déjà reçue bloque la réouverture.'}
      confirmLabel="Rouvrir"
      cancelLabel="Retour"
      loading={submission.pending}
      onConfirm={() => { void submission.run(() => reopen.mutateAsync(intervention.lockVersion), { title: 'Intervention rouverte' }, onClose); }}
    />
  );
}

