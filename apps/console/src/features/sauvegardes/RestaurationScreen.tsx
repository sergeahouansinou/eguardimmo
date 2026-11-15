'use client';

import { Alert, Button, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useRequestRestore } from '@/console/hooks/mutations';
import { useEquipe, useSauvegardes } from '@/console/hooks/queries';
import { RESTORE_SCOPE_LABELS, RESTORE_TARGET_LABELS, restoreFormSchema } from '@/console/schemas';
import type { Backup, Equipe, RestoreFormInput } from '@/console/schemas';
import { formatDateTime, formatStorage } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { RadioCards } from '@/ui/RadioCards';
import { KeyValueList, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

const SCOPE_OPTIONS = (Object.keys(RESTORE_SCOPE_LABELS) as (keyof typeof RESTORE_SCOPE_LABELS)[]).map((value) => ({
  value,
  label: RESTORE_SCOPE_LABELS[value],
}));

const ESTIMATE_MINUTES = { isole: 22, production: 25 } as const;

export function RestaurationScreen() {
  const backups = useSauvegardes();
  const team = useEquipe();
  return (
    <QueryState query={backups} label="Le formulaire de restauration">
      {(data) => (
        <QueryState query={team} label="L’équipe opérateur">
          {(equipe) => <Form backups={data.backups} equipe={equipe} />}
        </QueryState>
      )}
    </QueryState>
  );
}

function backupLabel(backup: Backup): string {
  return `${formatDateTime(backup.at)} · ${backup.kind === 'quotidienne' ? 'quotidienne' : 'mensuelle'} · ${formatStorage(backup.sizeMb)}`;
}

function Form({ backups, equipe }: { backups: Backup[]; equipe: Equipe }) {
  const router = useRouter();
  const notify = useNotify();
  const preselected = useSearchParams().get('sauvegarde');
  const request = useRequestRestore();
  const [pending, setPending] = useState<RestoreFormInput | null>(null);
  const validators = equipe.operators.filter((operator) => !operator.self && operator.state === 'actif' && operator.twoFactor);
  const initialBackup = backups.find((backup) => backup.id === preselected) ?? backups[0];
  const form = useZodForm<RestoreFormInput, RestoreFormInput>(restoreFormSchema, {
    backupId: initialBackup?.id ?? '',
    scope: 'base_documents',
    target: 'isole',
    reason: '',
    ticket: '',
    validatorId: validators[0]?.id ?? '',
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const backupId = useWatch({ control, name: 'backupId' });
  const target = useWatch({ control, name: 'target' });
  const validatorId = useWatch({ control, name: 'validatorId' });
  const backup = backups.find((candidate) => candidate.id === backupId);
  const validator = validators.find((candidate) => candidate.id === validatorId);

  const submit = handleSubmit((values) => {
    setPending(values);
  });

  return (
    <>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-[720px] flex-col gap-4">
        <PageHeader
          Link={Link}
          breadcrumb={[{ label: 'Sauvegardes', href: '/sauvegardes' }, { label: 'Demande de restauration' }]}
          title="Demander une restauration"
          subtitle="La demande est envoyée à un second opérateur. Rien n’est restauré avant son accord."
        />
        <Section id="source" title="Sauvegarde à restaurer">
          <div className="flex flex-col gap-3 pt-1">
            <Controller
              control={control}
              name="backupId"
              render={({ field }) => (
                <Select
                  label="Sauvegarde *"
                  placeholder="Choisir une sauvegarde"
                  searchable
                  searchPlaceholder="Rechercher une date"
                  options={backups.map((candidate) => ({ value: candidate.id, label: backupLabel(candidate) }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  error={formState.errors.backupId?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="scope"
              render={({ field }) => (
                <Select label="Périmètre *" placeholder="Choisir un périmètre" options={SCOPE_OPTIONS} value={field.value} onValueChange={field.onChange} />
              )}
            />
            <span id="cible" className="text-caption text-fg-muted">
              Cible *
            </span>
            <RadioCards
              labelledBy="cible"
              value={target}
              onValueChange={(value) => { setValue('target', value === 'production' ? 'production' : 'isole', { shouldValidate: true }); }}
              options={[
                { value: 'isole', label: RESTORE_TARGET_LABELS.isole, description: 'Copie de contrôle, sans effet sur la production' },
                {
                  value: 'production',
                  label: RESTORE_TARGET_LABELS.production,
                  description: `Remplace les données actuelles, coupure d’environ ${String(ESTIMATE_MINUTES.production)} min`,
                },
              ]}
            />
          </div>
        </Section>
        <Section id="justification" title="Justification">
          <div className="flex flex-col gap-3 pt-1">
            <Textarea
              label="Motif *"
              placeholder="Test trimestriel de restauration, runbook RUN-07."
              rows={3}
              error={formState.errors.reason?.message}
              {...register('reason')}
            />
            <TextField label="Référence du ticket" placeholder="SUP-2094" error={formState.errors.ticket?.message} {...register('ticket')} />
          </div>
        </Section>
        <Section id="validation" title="Double validation">
          <div className="flex flex-col gap-3 pt-1">
            <KeyValueList items={[{ label: 'Demandeur', value: `${equipe.operators.find((operator) => operator.self)?.name ?? 'Vous'} (vous)` }]} />
            <Controller
              control={control}
              name="validatorId"
              render={({ field }) => (
                <Select
                  label="Second validateur *"
                  placeholder="Choisir un opérateur"
                  options={validators.map((operator) => ({ value: operator.id, label: operator.name }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  hint="Un autre opérateur, avec la double authentification."
                  error={formState.errors.validatorId?.message}
                />
              )}
            />
          </div>
        </Section>
        <Section id="recapitulatif" title="Récapitulatif">
          <KeyValueList
            items={[
              { label: 'Source', value: backup ? formatDateTime(backup.at) : '—' },
              { label: 'Cible', value: RESTORE_TARGET_LABELS[target] },
              { label: 'Durée estimée', value: `${String(ESTIMATE_MINUTES[target])} min` },
              { label: 'Validation', value: validator?.name ?? '—' },
            ]}
          />
        </Section>
        {target === 'production' ? (
          <Alert tone="warning">
            <span className="flex items-start gap-2">
              <Icon icon={TriangleAlert} className="mt-0.5 shrink-0" />
              Vers la production, la restauration remplace les données actuelles et coupe l’accès pendant environ {String(ESTIMATE_MINUTES.production)} minutes. Le second
              validateur doit confirmer.
            </span>
          </Alert>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" asChild>
            <Link href="/sauvegardes">Annuler</Link>
          </Button>
          <Button type="submit">Envoyer pour validation</Button>
        </div>
      </form>
      {backup ? (
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => { if (!open) setPending(null); }}
          title="Confirmer la demande de restauration"
          description={`Vous demandez la restauration de ${backup.name} vers ${RESTORE_TARGET_LABELS[target].toLowerCase()}. ${target === 'production' ? 'Les données actuelles seront remplacées après l’accord du second validateur.' : 'Aucune donnée de production n’est touchée.'}`}
          confirmLabel="Envoyer pour validation"
          tone={target === 'production' ? 'danger' : 'primary'}
          requiredPhrase={backup.name}
          phraseLabel="Nom de la sauvegarde"
          onConfirm={async () => {
            if (!pending) return;
            try {
              await request.mutateAsync({ ...pending, confirmation: backup.name });
            } catch (error) {
              throw new Error(errorMessage(error));
            }
            notify.success('Demande envoyée', `${validator?.name ?? 'Le second validateur'} doit confirmer avant toute restauration.`);
            router.push('/sauvegardes');
          }}
        />
      ) : null}
    </>
  );
}
