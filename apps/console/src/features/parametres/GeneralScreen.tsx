'use client';

import { Alert, Badge, Icon, TextField } from '@eguardimmo/ui';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '@/console/hooks/core';
import { useSaveGeneralSettings } from '@/console/hooks/mutations';
import { useGeneralSettings } from '@/console/hooks/queries';
import { generalSettingsInputSchema } from '@/console/schemas';
import type { GeneralSettings } from '@/console/schemas';
import { wholeNumber } from '@/lib/formFields';
import { formatDate } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { QueryState } from '@/ui/QueryState';
import { Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { LastChange } from './LastChange';
import { SaveBar } from './SaveBar';

const generalFormSchema = z.object({
  webDomain: generalSettingsInputSchema.shape.webDomain,
  apiDomain: generalSettingsInputSchema.shape.apiDomain,
  mailDomain: generalSettingsInputSchema.shape.mailDomain,
  senderName: generalSettingsInputSchema.shape.senderName,
  senderEmail: generalSettingsInputSchema.shape.senderEmail,
  replyTo: generalSettingsInputSchema.shape.replyTo,
  emailsPerDay: wholeNumber('E-mails par jour', 1, 1_000_000),
  maxFileMb: wholeNumber('Taille maximale', 1, 500),
  storageGb: wholeNumber('Stockage', 1, 100_000),
  backupRetentionDays: wholeNumber('Conservation', 7, 365),
});

function valuesOf(settings: GeneralSettings) {
  return {
    webDomain: settings.webDomain,
    apiDomain: settings.apiDomain,
    mailDomain: settings.mailDomain,
    senderName: settings.senderName,
    senderEmail: settings.senderEmail,
    replyTo: settings.replyTo,
    emailsPerDay: String(settings.emailsPerDay),
    maxFileMb: String(settings.maxFileMb),
    storageGb: String(settings.storageGb),
    backupRetentionDays: String(settings.backupRetentionDays),
  };
}

export function GeneralScreen() {
  const query = useGeneralSettings();
  return (
    <QueryState query={query} label="Les paramètres généraux">
      {(settings) => <GeneralForm settings={settings} />}
    </QueryState>
  );
}

function GeneralForm({ settings }: { settings: GeneralSettings }) {
  const notify = useNotify();
  const save = useSaveGeneralSettings();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useZodForm(generalFormSchema, valuesOf(settings));
  const { register, handleSubmit, reset, formState } = form;
  useEffect(() => {
    reset(valuesOf(settings));
  }, [settings, reset]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync(values);
      notify.success('Paramètres enregistrés', 'Le changement est consigné au journal d’audit.');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <Section id="domaines" title="Domaines">
        <div className="flex flex-col gap-3 pt-1">
          <TextField label="Portail web *" placeholder="app.eguardimmo.fr" error={formState.errors.webDomain?.message} {...register('webDomain')} />
          <TextField label="API *" placeholder="api.eguardimmo.fr" error={formState.errors.apiDomain?.message} {...register('apiDomain')} />
          <TextField
            label="Domaine d’envoi des e-mails *"
            placeholder="mail.eguardimmo.fr"
            hint={`Certificats valides jusqu’au ${formatDate(settings.certificatesValidUntil)}.`}
            error={formState.errors.mailDomain?.message}
            {...register('mailDomain')}
          />
        </div>
      </Section>
      <Section id="email-envoi" title="E-mail d’envoi">
        <div className="flex flex-col gap-3 pt-1">
          <TextField label="Nom de l’expéditeur *" placeholder="eGuardImmo" error={formState.errors.senderName?.message} {...register('senderName')} />
          <TextField
            label="Adresse d’expédition *"
            type="email"
            placeholder="ne-pas-repondre@mail.eguardimmo.fr"
            error={formState.errors.senderEmail?.message}
            {...register('senderEmail')}
          />
          <TextField
            label="Adresse de réponse"
            type="email"
            placeholder="support@eguardimmo.fr"
            error={formState.errors.replyTo?.message}
            {...register('replyTo')}
          />
          <div className="flex flex-wrap gap-2">
            <Badge tone={settings.spf ? 'success' : 'danger'}>
              <Icon icon={CircleCheck} size={14} />
              {settings.spf ? 'SPF valide' : 'SPF absent'}
            </Badge>
            <Badge tone={settings.dkim ? 'success' : 'danger'}>
              <Icon icon={CircleCheck} size={14} />
              {settings.dkim ? 'DKIM valide' : 'DKIM absent'}
            </Badge>
            <Badge tone={settings.dmarcStrong ? 'success' : 'warning'}>
              <Icon icon={TriangleAlert} size={14} />
              {settings.dmarcStrong ? 'DMARC strict' : 'DMARC à renforcer'}
            </Badge>
          </div>
        </div>
      </Section>
      <Section id="limites" title="Limites par défaut">
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <TextField label="E-mails par jour et par organisation *" inputMode="numeric" placeholder="2000" error={formState.errors.emailsPerDay?.message} {...register('emailsPerDay')} />
          <TextField label="Taille maximale d’un fichier, Mo *" inputMode="numeric" placeholder="10" error={formState.errors.maxFileMb?.message} {...register('maxFileMb')} />
          <TextField label="Stockage par organisation, Go *" inputMode="numeric" placeholder="50" error={formState.errors.storageGb?.message} {...register('storageGb')} />
          <TextField label="Conservation des sauvegardes, jours *" inputMode="numeric" placeholder="30" error={formState.errors.backupRetentionDays?.message} {...register('backupRetentionDays')} />
        </div>
      </Section>
      <LastChange change={settings.lastChange} />
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Info} className="mt-0.5 shrink-0" />
          Chaque changement de paramètre est consigné dans le journal d’audit avec son auteur.
        </span>
      </Alert>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <SaveBar pending={formState.isSubmitting} dirty={formState.isDirty} onCancel={() => { reset(valuesOf(settings)); setFailure(null); }} />
    </form>
  );
}
