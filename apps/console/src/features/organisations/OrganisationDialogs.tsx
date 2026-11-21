'use client';

import { Badge, TextField } from '@eguardimmo/ui';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useChangePlan, useUpdateOrganisation } from '@/console/hooks/mutations';
import { useSubscriptions } from '@/console/hooks/queries';
import { planServes, updateOrganisationInputSchema } from '@/console/schemas';
import { usersLabel } from '@/features/abonnements/limits';
import type { OrganisationDetail } from '@/console/schemas';
import { formatEuros } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { FormDialog } from '@/ui/FormDialog';
import { RadioCards } from '@/ui/RadioCards';
import { useNotify } from '@/ui/notify';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: OrganisationDetail;
}

export function ChangePlanDialog(props: DialogProps) {
  return props.open ? <ChangePlanForm {...props} /> : null;
}

function ChangePlanForm({ open, onOpenChange, detail }: DialogProps) {
  const notify = useNotify();
  const plans = useSubscriptions();
  const changePlan = useChangePlan(detail.organisation.id);
  const [planId, setPlanId] = useState(detail.organisation.planId);
  const [failure, setFailure] = useState<string | null>(null);
  const options = (plans.data?.plans ?? [])
    .filter((plan) => planServes(plan, detail.organisation.type))
    .map((plan) => ({
      value: plan.id,
      label: plan.name,
      description: `${formatEuros(plan.monthlyMinor)} HT par mois · ${usersLabel(plan.limits.users)}`,
      trailing: plan.id === detail.organisation.planId ? <Badge tone="info">Plan actuel</Badge> : undefined,
    }));
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Changer de plan"
      description={`${detail.organisation.name} · le changement s’applique immédiatement et est consigné au journal d’audit.`}
      submitLabel="Changer de plan"
      pending={changePlan.isPending}
      failure={failure}
      onSubmit={(event) => {
        event.preventDefault();
        if (planId === detail.organisation.planId) {
          setFailure('Choisissez un plan différent du plan actuel.');
          return;
        }
        changePlan.mutate(planId, {
          onSuccess: () => {
            notify.success('Plan modifié', `${detail.organisation.name} passe sur le nouveau plan.`);
            onOpenChange(false);
          },
          onError: (error) => { setFailure(errorMessage(error)); },
        });
      }}
    >
      <span id="plan-choix" className="text-caption text-fg-muted">
        Plan
      </span>
      <RadioCards labelledBy="plan-choix" options={options} value={planId} onValueChange={setPlanId} />
    </FormDialog>
  );
}

export function EditOrganisationDialog({ open, onOpenChange, detail }: DialogProps) {
  const notify = useNotify();
  const update = useUpdateOrganisation(detail.organisation.id);
  const form = useZodForm(updateOrganisationInputSchema, {
    name: detail.organisation.name,
    contactEmail: detail.contactEmail,
    headquarters: detail.headquarters,
  });
  const { register, handleSubmit, reset, formState } = form;
  useEffect(() => {
    if (open) reset({ name: detail.organisation.name, contactEmail: detail.contactEmail, headquarters: detail.headquarters });
  }, [open, detail, reset]);
  const submit = handleSubmit(async (values) => {
    await update.mutateAsync(values);
    notify.success('Informations enregistrées', 'La modification est consignée au journal d’audit.');
    onOpenChange(false);
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Modifier les informations"
      submitLabel="Enregistrer"
      pending={formState.isSubmitting}
      failure={update.isError ? errorMessage(update.error) : null}
      onSubmit={(event) => void submit(event)}
    >
      <TextField label="Nom de l’organisation" placeholder="Cabinet Delmas Immobilier" error={formState.errors.name?.message} {...register('name')} />
      <TextField
        label="E-mail de contact"
        type="email"
        placeholder="contact@delmas-immobilier.example"
        error={formState.errors.contactEmail?.message}
        {...register('contactEmail')}
      />
      <TextField label="Siège" placeholder="14 quai Saint-Antoine, 69002 Lyon" error={formState.errors.headquarters?.message} {...register('headquarters')} />
    </FormDialog>
  );
}
