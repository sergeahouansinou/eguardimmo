'use client';

import { RadioGroup, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import type { OrganisationEntitlements } from '@/platform/plans/subscriptions';
import { ApprovalRequestDialog } from '../shared/ApprovalRequestDialog';
import { EMPTY_OVERRIDE, validateOverride } from './overrideForm';
import type { OverrideDraft, OverrideErrors } from './overrideForm';
import { OVERRIDE_REASONS, OVERRIDE_REASON_LABELS } from './labels';

interface GrantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId: string;
  entitlements: OrganisationEntitlements['entitlements'];
}

export function GrantOverrideDialog({ open, onOpenChange, organisationId, entitlements }: GrantProps) {
  const [draft, setDraft] = useState<OverrideDraft>(EMPTY_OVERRIDE);
  const [errors, setErrors] = useState<OverrideErrors>({});
  const quotas = new Set(entitlements.filter((e) => e.kind === 'quota').map((e) => e.feature));
  const checked = validateOverride(draft, quotas, new Date());
  const set = (patch: Partial<OverrideDraft>) => {
    setDraft({ ...draft, ...patch });
    setErrors({});
  };
  const isQuota = quotas.has(draft.feature);

  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDraft(EMPTY_OVERRIDE);
          setErrors({});
        }
        onOpenChange(next);
      }}
      title="Demander une dérogation de droits"
      description="Une dérogation est datée et motivée ; elle prend effet quand un second opérateur la valide."
      action="subscriptions.override.grant"
      subjectId={organisationId}
      submitLabel="Demander la dérogation"
      payload={checked.ok ? checked.payload : undefined}
      beforeSubmit={() => {
        if (checked.ok) return true;
        setErrors(checked.errors);
        return false;
      }}
    >
      <Select
        label="Fonction"
        placeholder="Choisir une fonction"
        searchable
        options={entitlements.map((e) => ({ value: e.feature, label: e.label, description: e.kind === 'quota' ? 'Quota' : 'Fonction' }))}
        value={draft.feature}
        error={errors.feature}
        onValueChange={(feature) => { set({ feature, limit: '' }); }}
      />
      <RadioGroup
        label="Effet"
        options={[
          { value: 'true', label: 'Activer' },
          { value: 'false', label: 'Désactiver' },
        ]}
        value={draft.enabled}
        onValueChange={(enabled) => { set({ enabled: enabled === 'false' ? 'false' : 'true' }); }}
      />
      {isQuota ? (
        <TextField
          label="Limite (facultatif)"
          placeholder="Ex. 25"
          inputMode="numeric"
          value={draft.limit}
          error={errors.limit}
          hint="Laissez vide pour ne pas modifier la limite du plan."
          onChange={(event) => { set({ limit: event.target.value }); }}
        />
      ) : null}
      <TextField label="Fin de la dérogation" placeholder="AAAA-MM-JJ" type="date" value={draft.endsAt} error={errors.endsAt} hint="À venir, dans les 12 mois." onChange={(event) => { set({ endsAt: event.target.value }); }} />
      <RadioGroup
        label="Motif commercial ou technique"
        options={OVERRIDE_REASONS.map((value) => ({ value, label: OVERRIDE_REASON_LABELS[value] ?? value }))}
        value={draft.reasonCode}
        error={errors.reasonCode}
        onValueChange={(reasonCode) => { set({ reasonCode }); }}
      />
    </ApprovalRequestDialog>
  );
}

interface RevokeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrideId: string;
  featureLabel: string;
}

export function RevokeOverrideDialog({ open, onOpenChange, overrideId, featureLabel }: RevokeProps) {
  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Retirer la dérogation « ${featureLabel} »`}
      description="La dérogation cesse d’agir quand un second opérateur valide le retrait."
      action="subscriptions.override.revoke"
      subjectId={overrideId}
      submitLabel="Demander le retrait"
      tone="danger"
    />
  );
}
