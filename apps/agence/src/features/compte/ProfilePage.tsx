"use client";

import { Badge, Button, Card, CardHeader, CardTitle, TextField } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { FileDrop, FormSelect, SettingsPage, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { toCsv, downloadCsv } from "@/lib/csv";
import { messageOf } from "@/features/shared/errors";
import { IMAGE_RULES } from "@/features/shared/files";
import { useExportData, useProfile, useSaveProfile } from "./hooks";
import { CIVILITY_OPTIONS, LANGUAGE_OPTIONS, TIMEZONE_OPTIONS, profileInputSchema } from "./profileSchemas";
import type { Profile, ProfileFormValues } from "./profileSchemas";

const formSchema = profileInputSchema.omit({ photoName: true });

function valuesOf(profile: Profile): ProfileFormValues {
  return {
    civility: profile.civility,
    firstName: profile.firstName,
    lastName: profile.lastName,
    jobTitle: profile.jobTitle,
    mobile: profile.mobile,
    language: profile.language,
    timezone: profile.timezone,
  };
}

function ProfileForm({ profile }: { profile: Profile }) {
  const notify = useNotify();
  const save = useSaveProfile();
  const exportData = useExportData();
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, setError, formState } = useSchemaForm(formSchema, valuesOf(profile));
  const { errors } = formState;
  const dirty = formState.isDirty || photo !== null;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync({ ...values, photoName: photo?.name ?? profile.photoName });
      reset(values);
      setPhoto(null);
      notify.success("Profil enregistré");
    } catch (error) {
      setFormError(applyServerError(setError, error));
    }
  });

  const download = async () => {
    try {
      const data = await exportData.mutateAsync(undefined);
      downloadCsv(data.filename, toCsv(data.header, data.rows));
      notify.success("Export prêt", "Vos données ont été téléchargées.");
    } catch (error) {
      notify.error("Export impossible", messageOf(error));
    }
  };

  return (
    <SettingsPage
      currentHref="/compte"
      subtitle="Votre identité et vos coordonnées, visibles par l'équipe de l'agence."
      onSubmit={(event) => void submit(event)}
      onCancel={() => {
        reset(valuesOf(profile));
        setPhoto(null);
        setFormError(null);
      }}
      dirty={dirty}
      saving={save.isPending}
      formError={formError}
    >
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Identité">
            <CardHeader>
              <CardTitle as="h2">Identité</CardTitle>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
              <FormSelect control={control} name="civility" label="Civilité" placeholder="Choisir" options={CIVILITY_OPTIONS} />
              <TextField label="Prénom *" placeholder="Ex. : Sophie" autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
              <TextField label="Nom *" placeholder="Ex. : Delmas" autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
            </div>
            <TextField label="Fonction" placeholder="Ex. : Titulaire du cabinet" error={errors.jobTitle?.message} {...register("jobTitle")} />
          </Card>
          <Card role="region" aria-label="Coordonnées">
            <CardHeader>
              <CardTitle as="h2">Coordonnées</CardTitle>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Téléphone mobile *"
                type="tel"
                placeholder="Ex. : +33 6 12 34 56 78"
                autoComplete="tel"
                error={errors.mobile?.message}
                {...register("mobile")}
              />
              <TextField
                label="E-mail *"
                placeholder="Ex. : prenom.nom@agence.example"
                value={profile.email}
                readOnly
                hint="Se modifie dans Connexion et sécurité"
              />
            </div>
          </Card>
          <Card role="region" aria-label="Préférences">
            <CardHeader>
              <CardTitle as="h2">Préférences</CardTitle>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormSelect control={control} name="language" label="Langue" placeholder="Choisir une langue" options={LANGUAGE_OPTIONS} />
              <FormSelect control={control} name="timezone" label="Fuseau horaire" placeholder="Choisir un fuseau" options={TIMEZONE_OPTIONS} />
            </div>
          </Card>
          <Card role="region" aria-label="Photo de profil">
            <CardHeader>
              <CardTitle as="h2">Photo de profil</CardTitle>
              {profile.photoName && !photo ? <span className="text-caption text-fg-subtle">Actuelle : {profile.photoName}</span> : null}
            </CardHeader>
            <FileDrop
              title="Déposer une photo"
              hint="PNG ou JPG, 2 Mo au maximum"
              rules={IMAGE_RULES}
              file={photo}
              onFileChange={setPhoto}
            />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Rôle">
            <CardHeader>
              <CardTitle as="h2">Rôle</CardTitle>
              <Badge tone="info">{profile.roleLabel}</Badge>
            </CardHeader>
            <p className="text-body text-fg-muted">Votre rôle détermine ce que vous voyez et modifiez dans l'espace de l'agence.</p>
            <Button asChild variant="secondary">
              <Link href="/equipe/roles">Rôles et droits</Link>
            </Button>
          </Card>
          <Card role="region" aria-label="Mes données">
            <CardHeader>
              <CardTitle as="h2">Mes données</CardTitle>
            </CardHeader>
            <p className="text-body text-fg-muted">Identité, coordonnées et préférences de votre compte.</p>
            <Button variant="secondary" loading={exportData.isPending} onClick={() => void download()}>
              Exporter mes données
            </Button>
          </Card>
        </aside>
      </div>
    </SettingsPage>
  );
}

export function ProfilePage() {
  const query = useProfile();
  return (
    <QueryState query={query} label="Le profil">
      {(profile) => <ProfileForm profile={profile} />}
    </QueryState>
  );
}
