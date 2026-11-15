'use client';

import { Alert, Badge, Button, TextField } from '@eguardimmo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { errorMessage } from '@/console/hooks/core';
import { useInviteOperator } from '@/console/hooks/mutations';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_RIGHTS, inviteInputSchema } from '@/console/schemas';
import type { InviteInput, OperatorRole, RightLevel } from '@/console/schemas';
import { useZodForm } from '@/lib/useZodForm';
import { PageHeader } from '@/ui/PageHeader';
import { RadioCards } from '@/ui/RadioCards';
import { Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

const ROLES = Object.keys(ROLE_LABELS) as OperatorRole[];
const LEVEL_LABELS: Record<RightLevel, string> = { modifier: 'Modification', lecture: 'Lecture', aucun: 'Aucun accès' };
const LEVEL_TONES = { modifier: 'success', lecture: 'info', aucun: 'neutral' } as const;

export function InviteScreen() {
  const router = useRouter();
  const notify = useNotify();
  const invite = useInviteOperator();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useZodForm<InviteInput, InviteInput>(inviteInputSchema, { firstName: '', lastName: '', email: '', role: 'support' });
  const { register, control, handleSubmit, watch, formState } = form;
  const role = watch('role');

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await invite.mutateAsync(values);
      notify.success('Invitation envoyée', `${values.email} recevra un lien valable 7 jours. L’envoi est consigné au journal d’audit.`);
      router.push('/equipe');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex max-w-[720px] flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Équipe opérateur', href: '/equipe' }, { label: 'Inviter un opérateur' }]}
        title="Inviter un opérateur"
        subtitle="L’invité configure son mot de passe et sa double authentification à la première connexion."
      />
      <Section id="identite" title="Identité">
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <TextField label="Prénom *" placeholder="Camille" error={formState.errors.firstName?.message} {...register('firstName')} />
          <TextField label="Nom *" placeholder="Martin" error={formState.errors.lastName?.message} {...register('lastName')} />
          <div className="sm:col-span-2">
            <TextField
              label="E-mail professionnel *"
              type="email"
              placeholder="camille.martin@eguardimmo.fr"
              error={formState.errors.email?.message}
              {...register('email')}
            />
          </div>
        </div>
      </Section>
      <Section id="role" title="Rôle">
        <div className="pt-1">
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <RadioCards
                labelledBy="role"
                options={ROLES.map((value) => ({ value, label: ROLE_LABELS[value], description: ROLE_DESCRIPTIONS[value] }))}
                value={field.value}
                onValueChange={(value) => { field.onChange(value); }}
              />
            )}
          />
        </div>
      </Section>
      <Section id="droits" title={`Droits du rôle ${ROLE_LABELS[role].toLowerCase()}`}>
        <ul aria-live="polite">
          {ROLE_RIGHTS[role].map((right) => (
            <li key={right.area} className="flex min-h-10 items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
              <span className="text-body">{right.area}</span>
              <Badge tone={LEVEL_TONES[right.level]}>{LEVEL_LABELS[right.level]}</Badge>
            </li>
          ))}
        </ul>
      </Section>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" asChild>
          <Link href="/equipe">Annuler</Link>
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Envoyer l’invitation
        </Button>
      </div>
    </form>
  );
}
