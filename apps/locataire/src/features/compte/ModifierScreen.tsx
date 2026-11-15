'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Avatar, Button, Card, CardHeader, CardTitle, Icon, TextField } from '@eguardimmo/ui';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { ACCOUNT_TABS, RouteTabs } from '@/components/RouteTabs';
import { Async } from '@/components/ScreenState';
import { useProfile, useUpdateProfile } from '@/data/queries';
import { CODE_PATTERN, profileInputSchema } from '@/data/schemas/compte';
import type { Profile, ProfileInput } from '@/data/schemas/compte';
import { AVATAR_RULES, checkFile } from '@/lib/files';

export function ModifierScreen() {
  const profile = useProfile();
  return (
    <>
      <PageHeader
        title="Modifier mes informations"
        crumbs={[{ label: 'Mes informations', href: '/compte' }, { label: 'Modifier' }]}
        subtitle="Un changement d'e-mail ou de mobile est confirmé par un code."
      />
      <RouteTabs label="Mon compte" tabs={ACCOUNT_TABS} />
      <Async query={profile} errorTitle="Vos informations n’ont pas pu être chargées" rows={2}>
        {(data) => <ProfileForm profile={data} />}
      </Async>
    </>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const update = useUpdateProfile();
  const [pending, setPending] = useState<ProfileInput | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [photo, setPhoto] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      profession: profile.profession,
      mobile: profile.mobile,
      email: profile.email,
      bankHolder: profile.bankHolder,
      photoName: profile.photoName,
    },
  });
  const { register, handleSubmit, formState, setValue } = form;

  const changePhoto = (next: File[]) => {
    const file = next[0];
    if (!file) {
      setPhoto([]);
      setValue('photoName', null);
      setPhotoError(undefined);
      return;
    }
    const check = checkFile(file, AVATAR_RULES);
    if (!check.ok) {
      setPhotoError(check.error);
      return;
    }
    setPhotoError(undefined);
    setPhoto([file]);
    setValue('photoName', file.name);
  };

  const save = (values: ProfileInput, confirmation?: string) => {
    update.mutate(
      { values, code: confirmation },
      {
        onSuccess: () => {
          setPending(null);
          show({ tone: 'success', title: 'Informations enregistrées', detail: 'Vos modifications sont prises en compte.', path: '/compte' });
          router.push('/compte');
        },
        onError: (error) => {
          if (pending) setCodeError(error.message);
        },
      },
    );
  };

  const submit = handleSubmit((values) => {
    const contactChanged = values.email !== profile.email || values.mobile !== profile.mobile;
    if (contactChanged) {
      setCode('');
      setCodeError(undefined);
      setPending(values);
      return;
    }
    save(values);
  });

  const confirmCode = () => {
    if (!pending) return;
    if (!CODE_PATTERN.test(code.trim())) {
      setCodeError('Le code comporte 6 chiffres.');
      return;
    }
    setCodeError(undefined);
    save(pending, code.trim());
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {update.isError && !pending ? (
        <Alert tone="danger" title="Les modifications n’ont pas pu être enregistrées">
          {update.error.message}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="mo-identite" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="mo-identite">Identité</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Prénom *" placeholder="Koffi" autoComplete="given-name" {...register('firstName')} error={formState.errors.firstName?.message} />
              <TextField label="Nom *" placeholder="Adjovi" autoComplete="family-name" {...register('lastName')} error={formState.errors.lastName?.message} />
              <div className="sm:col-span-2">
                <TextField label="Profession" placeholder="Ingénieur" {...register('profession')} error={formState.errors.profession?.message} />
              </div>
            </div>
          </Card>
          <Card role="region" aria-labelledby="mo-contact" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="mo-contact">Coordonnées</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Mobile *"
                placeholder="+33 6 12 34 56 78"
                type="tel"
                autoComplete="tel"
                {...register('mobile')}
                error={formState.errors.mobile?.message}
              />
              <TextField
                label="E-mail *"
                placeholder="koffi.adjovi@example.com"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={formState.errors.email?.message}
              />
            </div>
          </Card>
          <Card role="region" aria-labelledby="mo-banque" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="mo-banque">Banque</CardTitle>
            </CardHeader>
            <TextField
              label="Titulaire du compte *"
              placeholder="Koffi Adjovi"
              hint="L'IBAN se modifie dans le mandat de prélèvement SEPA."
              {...register('bankHolder')}
              error={formState.errors.bankHolder?.message}
            />
          </Card>
        </div>
        <Card role="region" aria-labelledby="mo-photo" className="px-4 py-3">
          <CardHeader>
            <CardTitle as="h2" id="mo-photo">Photo de profil</CardTitle>
          </CardHeader>
          <div className="flex items-center gap-3">
            <Avatar initials={`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`} size="lg" />
            <span className="min-w-0 truncate text-body text-fg-muted">{photo[0]?.name ?? profile.photoName ?? 'Aucune photo'}</span>
          </div>
          <FileDrop title="Choisir une photo" rules={AVATAR_RULES} files={photo} onFilesChange={changePhoto} error={photoError} />
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/compte">Annuler</Link>
        </Button>
        <Button type="submit" loading={update.isPending && !pending}>
          <Icon icon={Check} />
          Enregistrer
        </Button>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Confirmer le changement de coordonnées"
        description="Un code à 6 chiffres vous a été envoyé pour confirmer votre nouvelle adresse e-mail ou votre nouveau mobile."
        confirmLabel="Confirmer"
        tone="primary"
        loading={update.isPending}
        onConfirm={confirmCode}
        error={codeError}
      >
        <TextField
          label="Code de confirmation"
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => { setCode(event.target.value); }}
          hint="Code de démonstration : 123456"
        />
      </ConfirmDialog>
    </form>
  );
}
