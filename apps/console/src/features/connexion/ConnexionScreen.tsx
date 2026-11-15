'use client';

import { Alert, Button, TextField } from '@eguardimmo/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loginInputSchema, LOGIN_FAILURE_MESSAGE } from '@/console/schemas';
import { useConsoleSource } from '@/console/source';
import { useZodForm } from '@/lib/useZodForm';

type Failure = { kind: 'invalid' } | { kind: 'locked'; seconds: number } | { kind: 'technical' } | null;

function lockMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Trop de tentatives. Réessayez dans ${String(minutes)} ${minutes > 1 ? 'minutes' : 'minute'}.`;
}

export function ConnexionScreen() {
  const router = useRouter();
  const source = useConsoleSource();
  const [failure, setFailure] = useState<Failure>(null);
  const form = useZodForm(loginInputSchema, { email: '', password: '', code: '' });
  const { register, handleSubmit, setFocus, resetField, formState } = form;

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await source.auth.login(values);
      if (result.status === 'ok') {
        router.replace('/');
        return;
      }
      resetField('password');
      resetField('code');
      setFailure(result.status === 'locked' ? { kind: 'locked', seconds: result.retryAfterSeconds } : { kind: 'invalid' });
    } catch {
      setFailure({ kind: 'technical' });
    }
  });

  return (
    <div className="flex min-h-dvh flex-col items-center bg-page px-4 py-10 sm:pt-16">
      <main id="contenu" className="flex w-full max-w-[420px] flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} className="size-7 rounded-full" priority />
          <span className="inline-flex h-7 items-center rounded-sm bg-action-subtle px-2.5 text-caption font-semibold text-action-on-subtle">
            Console opérateur
          </span>
        </div>
        <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby="connexion-titre">
          <header className="flex flex-col gap-1">
            <h1 id="connexion-titre" className="text-page-title">
              Connexion opérateur
            </h1>
            <p className="text-body text-fg-muted">
              Accès réservé à l’équipe opérateur. Le code de double authentification est demandé à chaque connexion.
            </p>
          </header>
          {failure?.kind === 'invalid' ? <Alert tone="danger">{LOGIN_FAILURE_MESSAGE}</Alert> : null}
          {failure?.kind === 'locked' ? (
            <Alert tone="warning" title="Connexion temporairement bloquée">
              {lockMessage(failure.seconds)}
            </Alert>
          ) : null}
          {failure?.kind === 'technical' ? (
            <Alert tone="danger">La connexion a échoué. Réessayez dans un instant.</Alert>
          ) : null}
          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
            <TextField
              label="E-mail"
              type="email"
              autoComplete="username"
              placeholder="prenom.nom@eguardimmo.fr"
              error={formState.errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              error={formState.errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Code à 6 chiffres"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123 456"
              error={formState.errors.code?.message}
              {...register('code')}
            />
            <Button type="submit" loading={formState.isSubmitting}>
              Se connecter
            </Button>
          </form>
          <p className="text-caption text-fg-subtle">
            Code de secours ou mot de passe oublié : passez par l’administrateur de la console, qui réinitialise votre accès.
          </p>
        </section>
      </main>
    </div>
  );
}
