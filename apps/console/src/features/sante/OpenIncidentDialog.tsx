'use client';

import { Select, TextField, Textarea } from '@eguardimmo/ui';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useModules } from '@/console/hooks/queries';
import { useOpenIncident } from '@/console/hooks/mutations';
import { openIncidentInputSchema } from '@/console/schemas';
import { useZodForm } from '@/lib/useZodForm';
import { FormDialog } from '@/ui/FormDialog';
import { useNotify } from '@/ui/notify';

const SEVERITIES = [
  { value: '1', label: 'Sévérité 1 : service indisponible' },
  { value: '2', label: 'Sévérité 2 : service dégradé' },
  { value: '3', label: 'Sévérité 3 : gêne mineure' },
];

export function OpenIncidentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const notify = useNotify();
  const modules = useModules({});
  const openIncident = useOpenIncident();
  const form = useZodForm(openIncidentInputSchema, { title: '', severity: '2', moduleId: '', summary: '' });
  const { register, control, handleSubmit, reset, formState } = form;
  const moduleOptions = [
    { value: '', label: 'Plateforme entière' },
    ...(modules.data?.rows ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];
  const submit = handleSubmit(async (values) => {
    const result = await openIncident.mutateAsync(values);
    notify.success('Incident ouvert', 'L’ouverture est consignée au journal d’audit.');
    reset();
    onOpenChange(false);
    router.push(`/sante/incidents/${result.id}`);
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ouvrir un incident"
      description="L’incident apparaît sur la santé du système et dans le journal d’audit."
      submitLabel="Ouvrir l’incident"
      pending={formState.isSubmitting}
      failure={openIncident.isError ? errorMessage(openIncident.error) : null}
      onSubmit={(event) => void submit(event)}
    >
      <TextField
        label="Titre"
        placeholder="Messagerie dégradée, file d’envoi ralentie"
        error={formState.errors.title?.message}
        {...register('title')}
      />
      <Controller
        control={control}
        name="severity"
        render={({ field }) => (
          <Select
            label="Sévérité"
            placeholder="Choisir une sévérité"
            options={SEVERITIES}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="moduleId"
        render={({ field }) => (
          <Select
            label="Module concerné"
            placeholder="Choisir un module"
            options={moduleOptions}
            value={field.value ?? ''}
            onValueChange={field.onChange}
            searchable
            searchPlaceholder="Rechercher un module"
          />
        )}
      />
      <Textarea
        label="Description"
        placeholder="Symptômes observés, depuis quand, organisations touchées"
        rows={3}
        error={formState.errors.summary?.message}
        {...register('summary')}
      />
    </FormDialog>
  );
}
