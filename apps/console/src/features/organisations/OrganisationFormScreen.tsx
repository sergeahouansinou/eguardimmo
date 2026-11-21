'use client';

import { Alert, Button, Checkbox, Icon, Select, TextField } from '@eguardimmo/ui';
import { Info, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useCreateOrganisation } from '@/console/hooks/mutations';
import { useOverview, useSubscriptions } from '@/console/hooks/queries';
import { ORGANISATION_TYPE_LABELS, createOrganisationInputSchema, planServes } from '@/console/schemas';
import { usersLabel } from '@/features/abonnements/limits';
import type { OrganisationType, PlanRow } from '@/console/schemas';
import { dayKey, formatDate, formatEuros } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { RadioCards } from '@/ui/RadioCards';
import { KeyValueList, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

const TYPE_OPTIONS = (Object.keys(ORGANISATION_TYPE_LABELS) as OrganisationType[]).map((value) => ({
  value,
  label: ORGANISATION_TYPE_LABELS[value],
}));

export function OrganisationFormScreen() {
  const plans = useSubscriptions();
  return (
    <QueryState query={plans} label="Le formulaire">
      {(overview) => <FormContent plans={overview.plans} />}
    </QueryState>
  );
}

function addDaysIso(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function FormContent({ plans }: { plans: PlanRow[] }) {
  const overview = useOverview();
  const router = useRouter();
  const notify = useNotify();
  const create = useCreateOrganisation();
  const [failure, setFailure] = useState<string | null>(null);
  const firstPlan = plans.find((plan) => planServes(plan, 'agence')) ?? plans[0];
  const form = useZodForm(createOrganisationInputSchema, {
    name: '',
    type: 'agence',
    siren: '',
    headquarters: '',
    holderFirstName: '',
    holderLastName: '',
    holderEmail: '',
    planId: firstPlan?.id ?? '',
    trial: true,
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const type = useWatch({ control, name: 'type' });
  const planId = useWatch({ control, name: 'planId' });
  const trial = useWatch({ control, name: 'trial' });
  const availablePlans = plans.filter((plan) => planServes(plan, type));
  const plan = plans.find((candidate) => candidate.id === planId);

  useEffect(() => {
    if (availablePlans.length > 0 && !availablePlans.some((candidate) => candidate.id === planId)) {
      setValue('planId', availablePlans[0]?.id ?? '');
    }
  }, [availablePlans, planId, setValue]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await create.mutateAsync(values);
      notify.success('Organisation créée', `${values.name} : l’invitation est envoyée à ${values.holderEmail}.`);
      router.push(`/organisations/${result.id}`);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  const today = dayKey(overview.data?.generatedAt ?? '2026-11-13T12:00:00Z');
  const trialDays = plan?.trialDays ?? 0;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-[720px] flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Organisations', href: '/organisations' }, { label: 'Nouvelle organisation' }]}
        title="Nouvelle organisation"
        subtitle="Le titulaire reçoit une invitation valable 7 jours pour créer son accès. L’organisation démarre avec les modules de son plan."
      />
      <Section id="identite" title="Identité">
        <div className="flex flex-col gap-3 pt-1">
          <TextField label="Nom de l’organisation *" placeholder="Agence des Quais" error={formState.errors.name?.message} {...register('name')} />
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select label="Type *" placeholder="Choisir un type" options={TYPE_OPTIONS} value={field.value} onValueChange={field.onChange} />
            )}
          />
          <TextField label="SIREN" inputMode="numeric" placeholder="532 118 764" error={formState.errors.siren?.message} {...register('siren')} />
          <TextField
            label="Adresse du siège *"
            placeholder="14 quai Saint-Antoine, 69002 Lyon"
            error={formState.errors.headquarters?.message}
            {...register('headquarters')}
          />
        </div>
      </Section>
      <Section id="titulaire" title="Titulaire">
        <div className="flex flex-col gap-3 pt-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Prénom *" placeholder="Claire" error={formState.errors.holderFirstName?.message} {...register('holderFirstName')} />
            <TextField label="Nom *" placeholder="Vasseur" error={formState.errors.holderLastName?.message} {...register('holderLastName')} />
          </div>
          <TextField
            label="E-mail *"
            type="email"
            placeholder="direction@agence-des-quais.example"
            hint="L’invitation est envoyée à cette adresse."
            error={formState.errors.holderEmail?.message}
            {...register('holderEmail')}
          />
        </div>
      </Section>
      <Section id="plan" title="Plan *">
        <div className="flex flex-col gap-3 pt-1">
          <RadioCards
            labelledBy="plan"
            options={availablePlans.map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
              description: `${formatEuros(candidate.monthlyMinor)} HT par mois · ${usersLabel(candidate.limits.users)}${candidate.moduleIds.length > 0 ? `, ${String(candidate.moduleIds.length)} modules` : ''}`,
            }))}
            value={planId}
            onValueChange={(value) => { setValue('planId', value, { shouldValidate: true }); }}
          />
          {formState.errors.planId?.message ? <p className="text-caption text-fg-danger">{formState.errors.planId.message}</p> : null}
          <Controller
            control={control}
            name="trial"
            render={({ field }) => (
              <Checkbox
                label={`Essai de ${String(trialDays)} jours, sans carte bancaire`}
                checked={field.value}
                disabled={trialDays === 0}
                onChange={(event) => { field.onChange(event.target.checked); }}
              />
            )}
          />
        </div>
      </Section>
      <Section id="recapitulatif" title="Récapitulatif">
        <KeyValueList
          items={[
            { label: 'Plan', value: plan?.name ?? 'Aucun plan' },
            { label: 'Essai', value: trial && trialDays > 0 ? `${String(trialDays)} jours` : 'Sans essai' },
            ...(trial && trialDays > 0 ? [{ label: 'Fin d’essai', value: formatDate(addDaysIso(today, trialDays)) }] : []),
            { label: 'Modules', value: plan ? `${String(plan.moduleIds.length)} sur 21` : '-' },
          ]}
        />
      </Section>
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          La création est consignée dans le journal d’audit avec votre nom. Les données de la nouvelle organisation ne sont pas accessibles à
          l’opérateur.
        </span>
      </Alert>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" asChild>
          <Link href="/organisations">Annuler</Link>
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          <Icon icon={Plus} />
          Créer l’organisation
        </Button>
      </div>
    </form>
  );
}
