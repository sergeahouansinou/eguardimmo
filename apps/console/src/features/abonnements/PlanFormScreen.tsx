'use client';

import { Alert, Button, Checkbox, Chip, Icon, Select, TextField } from '@eguardimmo/ui';
import { Check, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useCreatePlan, useUpdatePlan } from '@/console/hooks/mutations';
import { useModules, usePlan } from '@/console/hooks/queries';
import { ORGANISATION_TYPE_LABELS } from '@/console/schemas';
import type { ModuleRow, OrganisationType, Plan, PlanDetail } from '@/console/schemas';
import { formatEuros, formatInteger, minorToInput } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { KeyValueList, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { planFormSchema, toPlanInput } from './planForm';
import type { PlanFormInput } from './planForm';

const AUDIENCE_OPTIONS = (Object.keys(ORGANISATION_TYPE_LABELS) as OrganisationType[]).map((value) => ({
  value,
  label: ORGANISATION_TYPE_LABELS[value],
}));

export function PlanFormScreen({ planId }: { planId?: string }) {
  const modules = useModules({});
  if (planId === undefined) {
    return (
      <QueryState query={modules} label="Le formulaire de plan">
        {(list) => <PlanForm modules={list.rows} detail={null} />}
      </QueryState>
    );
  }
  return <EditPlan planId={planId} modules={modules} />;
}

function EditPlan({ planId, modules }: { planId: string; modules: ReturnType<typeof useModules> }) {
  const plan = usePlan(planId);
  return (
    <QueryState
      query={plan}
      label="Le plan"
      notFound={{
        title: 'Plan introuvable',
        description: 'Ce plan n’existe pas ou a été retiré.',
        backHref: '/abonnements',
        backLabel: 'Retour aux abonnements',
      }}
    >
      {(detail) => (
        <QueryState query={modules} label="Le formulaire de plan">
          {(list) => <PlanForm modules={list.rows} detail={detail} />}
        </QueryState>
      )}
    </QueryState>
  );
}

function initialValues(plan: Plan | null): PlanFormInput {
  if (!plan) {
    return {
      name: '',
      code: '',
      audience: 'agence',
      description: '',
      monthly: '',
      yearly: '',
      trialDays: '14',
      users: '',
      lots: '',
      storageGb: '',
      emailsMonth: '',
      publicSignup: true,
    };
  }
  return {
    name: plan.name,
    code: plan.code,
    audience: plan.audience,
    description: plan.description,
    monthly: minorToInput(plan.monthlyMinor),
    yearly: minorToInput(plan.yearlyMinor),
    trialDays: String(plan.trialDays),
    users: String(plan.limits.users),
    lots: String(plan.limits.lots),
    storageGb: String(plan.limits.storageGb),
    emailsMonth: String(plan.limits.emailsMonth),
    publicSignup: plan.publicSignup,
  };
}

function PlanForm({ modules, detail }: { modules: ModuleRow[]; detail: PlanDetail | null }) {
  const router = useRouter();
  const notify = useNotify();
  const plan = detail?.plan ?? null;
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan(plan?.id ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [moduleIds, setModuleIds] = useState<Set<string>>(
    () => new Set(plan ? plan.moduleIds : modules.filter((module) => module.mandatory).map((module) => module.id)),
  );
  const [modulesError, setModulesError] = useState<string | null>(null);
  const form = useZodForm(planFormSchema, initialValues(plan));
  const { register, control, handleSubmit, formState } = form;
  const byId = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);

  const toggleModule = (module: ModuleRow, next: boolean) => {
    const updated = new Set(moduleIds);
    if (next) {
      const queue = [module.id];
      while (queue.length > 0) {
        const current = byId.get(queue.shift() ?? '');
        if (!current) continue;
        updated.add(current.id);
        queue.push(...current.requires.filter((required) => !updated.has(required)));
      }
    } else {
      updated.delete(module.id);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of modules) {
          if (updated.has(candidate.id) && candidate.requires.some((required) => !updated.has(required))) {
            updated.delete(candidate.id);
            changed = true;
          }
        }
      }
    }
    setModuleIds(updated);
    setModulesError(null);
  };

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    if (moduleIds.size === 0) {
      setModulesError('Sélectionnez au moins un module.');
      return;
    }
    try {
      const input = toPlanInput(values, [...moduleIds]);
      if (plan) {
        await updatePlan.mutateAsync(input);
        notify.success('Plan enregistré', 'La modification est consignée au journal d’audit.');
      } else {
        await createPlan.mutateAsync(input);
        notify.success('Plan créé', 'La création est consignée au journal d’audit.');
      }
      router.push('/abonnements');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  const title = plan ? `Plan ${plan.name}` : 'Nouveau plan';
  const monthlyChanged = plan !== null && formState.dirtyFields.monthly === true;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-[720px] flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Abonnements', href: '/abonnements' }, { label: title }]}
        title={title}
        subtitle="Les changements de prix s’appliquent à la prochaine échéance de chaque abonnement."
      />
      <Section id="identite" title="Identité du plan">
        <div className="flex flex-col gap-3 pt-1">
          <TextField label="Nom du plan *" placeholder="Agence" error={formState.errors.name?.message} {...register('name')} />
          <TextField
            label="Code *"
            placeholder="agence"
            hint="Identifiant technique, non modifiable une fois le plan en service."
            readOnly={plan !== null}
            error={formState.errors.code?.message}
            {...register('code')}
          />
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <Select
                label="Organisations concernées *"
                placeholder="Choisir un public"
                options={AUDIENCE_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
          <TextField
            label="Description"
            placeholder="Mandats, reversements et comptes rendus pour les agences"
            error={formState.errors.description?.message}
            {...register('description')}
          />
        </div>
      </Section>
      <Section id="tarifs" title="Tarifs">
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          <TextField label="Prix mensuel HT * (€)" inputMode="decimal" placeholder="199,00" error={formState.errors.monthly?.message} {...register('monthly')} />
          <TextField label="Prix annuel HT * (€)" inputMode="decimal" placeholder="1 990,00" error={formState.errors.yearly?.message} {...register('yearly')} />
          <TextField label="Essai gratuit, jours" inputMode="numeric" placeholder="30" error={formState.errors.trialDays?.message} {...register('trialDays')} />
        </div>
      </Section>
      <Section id="limites" title="Limites incluses">
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <TextField label="Utilisateurs *" inputMode="numeric" placeholder="15" error={formState.errors.users?.message} {...register('users')} />
          <TextField label="Lots sous gestion *" inputMode="numeric" placeholder="100" error={formState.errors.lots?.message} {...register('lots')} />
          <TextField label="Stockage, Go *" inputMode="numeric" placeholder="50" error={formState.errors.storageGb?.message} {...register('storageGb')} />
          <TextField label="E-mails par mois *" inputMode="numeric" placeholder="5000" error={formState.errors.emailsMonth?.message} {...register('emailsMonth')} />
        </div>
      </Section>
      <Section
        id="modules"
        title="Modules inclus"
        aside={<span className="text-caption text-fg-subtle">{`${String(moduleIds.size)} sur ${String(modules.length)}`}</span>}
      >
        <div className="flex flex-wrap gap-2 pt-1" role="group" aria-labelledby="modules">
          {modules.map((module) => (
            <Chip
              key={module.id}
              pressed={moduleIds.has(module.id)}
              disabled={module.mandatory}
              onClick={() => { toggleModule(module, !moduleIds.has(module.id)); }}
            >
              {module.name}
            </Chip>
          ))}
        </div>
        {modulesError ? <p className="pt-2 text-caption text-fg-danger">{modulesError}</p> : null}
        <p className="pt-3 text-caption text-fg-subtle">
          Un module retiré du plan disparaît du menu des organisations concernées à leur prochaine échéance. Les modules du socle sont obligatoires.
        </p>
      </Section>
      <Section id="recapitulatif" title="Récapitulatif">
        <KeyValueList
          items={[
            {
              label: 'Organisations',
              value: detail ? `${formatInteger(detail.organisations)}, dont ${formatInteger(detail.trials)} en essai` : 'Aucune pour le moment',
            },
            { label: 'Revenu mensuel', value: detail ? `${formatEuros(detail.mrrMinor)} HT` : '0 € HT' },
            { label: 'Visibilité', value: 'Inscription publique' },
          ]}
        />
        <div className="pt-3">
          <Controller
            control={control}
            name="publicSignup"
            render={({ field }) => (
              <Checkbox
                label="Plan proposé à l’inscription"
                checked={field.value}
                onChange={(event) => { field.onChange(event.target.checked); }}
              />
            )}
          />
        </div>
      </Section>
      {monthlyChanged && detail ? (
        <Alert tone="warning">
          <span className="flex items-start gap-2">
            <Icon icon={Info} className="mt-0.5 shrink-0" />
            Modifier le prix touche {formatInteger(detail.payingOrganisations)} abonnements payants. La modification est consignée dans le journal d’audit.
          </span>
        </Alert>
      ) : (
        <Alert tone="info">
          <span className="flex items-start gap-2">
            <Icon icon={Info} className="mt-0.5 shrink-0" />
            La création et chaque modification du plan sont consignées dans le journal d’audit.
          </span>
        </Alert>
      )}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" asChild>
          <Link href="/abonnements">Annuler</Link>
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          <Icon icon={Check} />
          Enregistrer le plan
        </Button>
      </div>
    </form>
  );
}
