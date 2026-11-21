'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Icon, TextField } from '@eguardimmo/ui';
import { MailCheck, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { FailureAlert } from '@/components/FailureAlert';
import { useFlash } from '@/components/flash';
import { SectionCard } from '@/components/Section';
import { ACCOUNT_WORDING } from '@/tenant/accountLabels';
import { useCancelEmailChange, useConfirmEmailChange, useRequestEmailChange } from '@/tenant/accountQueries';
import type { AccountProfile } from '@/tenant/accountSchemas';
import { forgetPendingEmail, rememberPendingEmail, usePendingEmail } from '@/tenant/pendingEmail';
import type { PendingEmail } from '@/tenant/pendingEmail';
import { CODE_LENGTH, codeFormSchema, emailFormSchema } from './accountForms';
import type { CodeValues, EmailValues } from './accountForms';

export function EmailChangeCard({ profile }: { profile: AccountProfile }) {
  const pending = usePendingEmail();
  return (
    <SectionCard id="mo-email" title="Adresse e-mail">
      <p className="text-body text-fg-muted">
        Adresse actuelle : <b className="text-fg">{profile.email}</b>. Un changement est confirmé par un code envoyé à la nouvelle adresse.
      </p>
      {pending === undefined ? null : pending === null ? (
        <RequestForm profile={profile} />
      ) : (
        <ConfirmForm pending={pending} />
      )}
    </SectionCard>
  );
}

function RequestForm({ profile }: { profile: AccountProfile }) {
  const request = useRequestEmailChange();
  const show = useFlash((state) => state.show);
  const { register, handleSubmit, formState, setError } = useForm<EmailValues>({ resolver: zodResolver(emailFormSchema), defaultValues: { email: '' } });
  const submit = handleSubmit((values) => {
    const email = values.email.trim();
    if (email.toLowerCase() === profile.email.toLowerCase()) {
      setError('email', { message: 'Cette adresse est déjà celle de votre compte.' });
      return;
    }
    request.mutate(email, {
      onSuccess: (minutes) => {
        rememberPendingEmail(email, minutes);
        show({ tone: 'success', title: 'Code envoyé', detail: `Un code a été envoyé à ${email}.`, path: '/compte/modifier' });
      },
    });
  });
  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {request.isError ? <FailureAlert title="Le code n’a pas pu être envoyé" error={request.error} wording={ACCOUNT_WORDING} /> : null}
      <TextField label="Nouvelle adresse e-mail *" placeholder="camille.martin@exemple.fr" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
      <div className="flex justify-end">
        <Button type="submit" loading={request.isPending}>
          <Icon icon={Send} />
          Recevoir un code
        </Button>
      </div>
    </form>
  );
}

function ConfirmForm({ pending }: { pending: PendingEmail }) {
  const confirm = useConfirmEmailChange();
  const cancel = useCancelEmailChange();
  const resend = useRequestEmailChange();
  const show = useFlash((state) => state.show);
  const { register, handleSubmit, formState, reset } = useForm<CodeValues>({ resolver: zodResolver(codeFormSchema), defaultValues: { code: '' } });
  const expiresAt = new Date(pending.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const submit = handleSubmit((values) => {
    confirm.mutate(values.code.trim(), {
      onSuccess: () => {
        forgetPendingEmail();
        show({ tone: 'success', title: 'Adresse e-mail modifiée', detail: `Votre adresse est désormais ${pending.email}.`, path: '/compte/modifier' });
      },
    });
  });
  const abandon = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        forgetPendingEmail();
      },
    });
  };
  const again = () => {
    resend.mutate(pending.email, {
      onSuccess: (duration) => {
        reset();
        rememberPendingEmail(pending.email, duration);
        show({ tone: 'success', title: 'Nouveau code envoyé', detail: `Un code a été envoyé à ${pending.email}.`, path: '/compte/modifier' });
      },
    });
  };
  const failure = confirm.isError ? confirm.error : cancel.isError ? cancel.error : resend.isError ? resend.error : null;
  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      <Alert tone="info" title="Changement en attente de confirmation">
        <span className="flex items-start gap-1.5">
          <Icon icon={MailCheck} size={16} className="mt-0.5 shrink-0" />
          Un code à {String(CODE_LENGTH)} chiffres a été envoyé à {pending.email}. Il expire vers {expiresAt}. Votre adresse actuelle reste valable jusque-là.
        </span>
      </Alert>
      {failure === null ? null : <FailureAlert title="L’opération n’a pas abouti" error={failure} wording={ACCOUNT_WORDING} />}
      <TextField
        label="Code de confirmation *"
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        {...register('code')}
        error={formState.errors.code?.message}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" loading={cancel.isPending} onClick={abandon}>
          Annuler le changement
        </Button>
        <Button variant="secondary" loading={resend.isPending} onClick={again}>
          Renvoyer un code
        </Button>
        <Button type="submit" loading={confirm.isPending}>
          Confirmer l’adresse
        </Button>
      </div>
    </form>
  );
}
