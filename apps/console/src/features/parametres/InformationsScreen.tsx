'use client';

import { Alert, Avatar, Button, Icon, Select, TextField } from '@eguardimmo/ui';
import { KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useChangePassword, useSaveProfile } from '@/console/hooks/mutations';
import { useProfile } from '@/console/hooks/queries';
import { PASSWORD_MIN_LENGTH, changePasswordInputSchema, profileInputSchema } from '@/console/schemas';
import type { Profile } from '@/console/schemas';
import { formatDate, formatDateTime } from '@/lib/format';
import { useZodForm } from '@/lib/useZodForm';
import { FormDialog } from '@/ui/FormDialog';
import { QueryState } from '@/ui/QueryState';
import { KeyValueList, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { SaveBar } from './SaveBar';

const LANGUAGES = [
  { value: 'Français', label: 'Français' },
  { value: 'English', label: 'English' },
];
const TIMEZONES = [
  { value: 'Europe/Paris, UTC+1', label: 'Europe/Paris, UTC+1' },
  { value: 'Europe/London, UTC+0', label: 'Europe/London, UTC+0' },
  { value: 'America/Montreal, UTC-5', label: 'America/Montreal, UTC-5' },
];

export function InformationsScreen() {
  const query = useProfile();
  return (
    <QueryState query={query} label="Votre profil">
      {(profile) => <ProfileForm profile={profile} />}
    </QueryState>
  );
}

function valuesOf(profile: Profile) {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    mobile: profile.mobile,
    language: profile.language,
    timezone: profile.timezone,
  };
}

function ProfileForm({ profile }: { profile: Profile }) {
  const notify = useNotify();
  const save = useSaveProfile();
  const [failure, setFailure] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const form = useZodForm(profileInputSchema, valuesOf(profile));
  const { register, control, handleSubmit, reset, formState } = form;
  useEffect(() => {
    reset(valuesOf(profile));
  }, [profile, reset]);
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync(values);
      notify.success('Profil enregistré', 'La modification est consignée au journal d’audit.');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar initials={profile.initials} size="lg" />
          <div className="flex flex-col">
            <b className="text-block-title">{`${profile.firstName} ${profile.lastName}`}</b>
            <span className="text-body text-fg-muted">
              {profile.role} · opérateur depuis le {formatDate(profile.operatorSince)}
            </span>
          </div>
        </div>
        <Section id="identite" title="Identité">
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <TextField label="Prénom *" placeholder="Lucas" error={formState.errors.firstName?.message} {...register('firstName')} />
            <TextField label="Nom *" placeholder="Bernard" error={formState.errors.lastName?.message} {...register('lastName')} />
            <div className="sm:col-span-2">
              <TextField
                label="E-mail professionnel *"
                type="email"
                placeholder="prenom.nom@eguardimmo.fr"
                error={formState.errors.email?.message}
                {...register('email')}
              />
            </div>
            <TextField label="Mobile d’astreinte" placeholder="+33 6 12 34 56 78" error={formState.errors.mobile?.message} {...register('mobile')} />
            <Controller
              control={control}
              name="language"
              render={({ field }) => <Select label="Langue" placeholder="Choisir une langue" options={LANGUAGES} value={field.value} onValueChange={field.onChange} />}
            />
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select label="Fuseau horaire" placeholder="Choisir un fuseau" options={TIMEZONES} value={field.value} onValueChange={field.onChange} />
              )}
            />
          </div>
        </Section>
        <Section id="securite-compte" title="Sécurité du compte">
          <KeyValueList
            items={[
              { label: 'Mot de passe', value: `Modifié le ${formatDate(profile.security.passwordChangedOn)}` },
              { label: '2FA', value: profile.security.method },
              { label: 'Dernière connexion', value: formatDateTime(profile.security.lastLoginAt) },
              { label: 'Origine', value: profile.security.origin },
            ]}
          />
          <div className="flex flex-wrap gap-2 pt-3">
            <Button variant="secondary" onClick={() => { setPasswordOpen(true); }}>
              <Icon icon={KeyRound} />
              Changer le mot de passe
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/parametres/securite">
                <Icon icon={ShieldCheck} />
                Gérer la double authentification
              </Link>
            </Button>
          </div>
        </Section>
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <SaveBar pending={formState.isSubmitting} dirty={formState.isDirty} onCancel={() => { reset(valuesOf(profile)); setFailure(null); }} />
      </form>
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const notify = useNotify();
  const change = useChangePassword();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useZodForm(changePasswordInputSchema, { current: '', next: '', confirm: '' });
  const { register, handleSubmit, reset, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await change.mutateAsync(values);
      notify.success('Mot de passe modifié', 'Vos autres sessions sont révoquées. Le changement est consigné au journal d’audit.');
      reset();
      onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setFailure(null);
        }
        onOpenChange(next);
      }}
      title="Changer le mot de passe"
      description={`Au moins ${String(PASSWORD_MIN_LENGTH)} caractères. Vos autres sessions sont révoquées.`}
      submitLabel="Changer le mot de passe"
      pending={formState.isSubmitting}
      failure={failure}
      onSubmit={(event) => void submit(event)}
    >
      <TextField label="Mot de passe actuel" type="password" autoComplete="current-password" placeholder="Votre mot de passe actuel" error={formState.errors.current?.message} {...register('current')} />
      <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" placeholder={`${String(PASSWORD_MIN_LENGTH)} caractères au moins`} error={formState.errors.next?.message} {...register('next')} />
      <TextField label="Confirmation" type="password" autoComplete="new-password" placeholder="Saisissez-le à nouveau" error={formState.errors.confirm?.message} {...register('confirm')} />
    </FormDialog>
  );
}
