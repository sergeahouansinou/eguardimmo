"use client";

import { Avatar, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useConformite } from "@/features/conformite/queries";
import { FileDrop } from "@/features/kit/FileDrop";
import { FormSelect, useSchemaForm } from "@/features/kit/form";
import { LinkButton } from "@/features/kit/LinkButton";
import { useNotify } from "@/features/kit/notify";
import { SettingsPage } from "@/features/kit/SettingsPage";
import { splitServerError, toFileMeta } from "@/features/kit/serverValidation";
import { formatDate } from "@/features/shared/dates";
import { IMAGE_RULES } from "@/features/shared/files";
import { parseMoney } from "@/features/shared/money";
import { initialsOf } from "@/lib/text";
import { formatSiren } from "./logic";
import { useIdentity, useSaveIdentity } from "./queries";
import { LEGAL_FORMS, identityFormSchema } from "./schemas";
import type { Identity, IdentityForm } from "./schemas";

const FORM_FIELDS: readonly string[] = ["companyName", "legalForm", "siren", "address", "postalCode", "city", "phone", "email"];

function capitalText(minor: number | null): string {
  return minor === null ? "" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(minor / 100);
}

function toForm(identity: Identity): IdentityForm {
  return {
    companyName: identity.companyName,
    legalForm: identity.legalForm,
    siren: formatSiren(identity.siren),
    capital: capitalText(identity.capitalMinor),
    address: identity.address,
    postalCode: identity.postalCode,
    city: identity.city,
    phone: identity.phone,
    email: identity.email,
  };
}

export function IdentityPage() {
  const query = useIdentity();
  return (
    <QueryState query={query} label="Les réglages de l’agence">
      {(identity) => <IdentitySettings identity={identity} />}
    </QueryState>
  );
}

function IdentitySettings({ identity }: { identity: Identity }) {
  const notify = useNotify();
  const save = useSaveIdentity();
  const conformite = useConformite();
  const form = useSchemaForm<IdentityForm, IdentityForm>(identityFormSchema, toForm(identity));
  const [logo, setLogo] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | undefined>();
  const [signatureError, setSignatureError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const { errors } = form.formState;
  const dirty = form.formState.isDirty || logo !== null || signature !== null;
  const carte = conformite.data?.pieces.find((piece) => piece.id === "carte-professionnelle");

  const clearFiles = () => {
    setLogo(null);
    setSignature(null);
    setLogoError(undefined);
    setSignatureError(undefined);
    setResetCount((count) => count + 1);
  };

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        companyName: values.companyName,
        legalForm: values.legalForm,
        siren: values.siren,
        capitalMinor: values.capital.trim() === "" ? null : parseMoney(values.capital),
        address: values.address,
        postalCode: values.postalCode,
        city: values.city,
        phone: values.phone,
        email: values.email,
        logo: logo ? toFileMeta(logo) : null,
        signature: signature ? toFileMeta(signature) : null,
      });
      form.reset(toForm(saved));
      clearFiles();
      notify.success("Identité de l’agence enregistrée", "Elle sera reprise sur les mandats et les comptes rendus.");
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      Object.entries(fields).forEach(([name, text]) => {
        if (name === "logo") setLogoError(text);
        else if (name === "signature") setSignatureError(text);
        else if (FORM_FIELDS.includes(name)) form.setError(name as keyof IdentityForm, { type: "server", message: text });
      });
      setFormError(message);
    }
  });

  return (
    <SettingsPage
      currentHref="/reglages"
      subtitle="Identité, adresse et carte professionnelle, reprises sur les mandats et les comptes rendus."
      dirty={dirty}
      saving={save.isPending}
      formError={formError}
      onSubmit={(event) => {
        void submit(event);
      }}
      onCancel={() => {
        form.reset(toForm(identity));
        clearFiles();
        setFormError(null);
      }}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard title="Identité">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <TextField label="Raison sociale *" placeholder="Ex. : Cabinet Delmas Immobilier" error={errors.companyName?.message} {...form.register("companyName")} />
              <FormSelect
                control={form.control}
                name="legalForm"
                label="Forme juridique *"
                placeholder="Choisir une forme juridique"
                options={LEGAL_FORMS.map((legalForm) => ({ value: legalForm, label: legalForm }))}
              />
              <TextField
                label="SIREN *"
                inputMode="numeric"
                placeholder="Ex. : 123 456 782"
                error={errors.siren?.message}
                {...form.register("siren")}
              />
              <TextField
                label="Capital social (€)"
                inputMode="decimal"
                placeholder="Ex. : 20 000"
                error={errors.capital?.message}
                {...form.register("capital")}
              />
            </div>
          </SectionCard>
          <SectionCard title="Adresse et contact">
            <TextField label="Adresse *" placeholder="Ex. : 24 avenue de la République" error={errors.address?.message} {...form.register("address")} />
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <TextField label="Code postal *" inputMode="numeric" placeholder="Ex. : 75011" error={errors.postalCode?.message} {...form.register("postalCode")} />
              <TextField label="Ville *" placeholder="Ex. : Paris" error={errors.city?.message} {...form.register("city")} />
              <TextField label="Téléphone *" type="tel" placeholder="Ex. : +33 1 00 00 00 21" error={errors.phone?.message} {...form.register("phone")} />
              <TextField
                label="E-mail de contact *"
                type="email"
                placeholder="Ex. : contact@votre-agence.fr"
                error={errors.email?.message}
                {...form.register("email")}
              />
            </div>
          </SectionCard>
          <SectionCard
            title="Carte professionnelle"
            action={
              <LinkButton href="/conformite" variant="ghost" size="sm">
                Voir la conformité
              </LinkButton>
            }
          >
            {conformite.isError ? (
              <p className="text-body text-fg-danger">La carte professionnelle n’a pas pu être lue. Rechargez la page.</p>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <TextField label="Numéro" readOnly placeholder="Chargement" value={carte?.reference ?? ""} />
                <TextField label="Valable jusqu’au" readOnly placeholder="Chargement" value={carte ? formatDate(carte.expiresOn) : ""} />
                <TextField
                  label="Mention"
                  readOnly
                  placeholder="Chargement"
                  hint="Se gère dans Conformité."
                  value={carte?.subtitle ?? ""}
                  className="sm:col-span-2"
                />
              </div>
            )}
          </SectionCard>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <SectionCard title="Logo">
            <div className="flex items-center gap-3">
              <Avatar initials={initialsOf(identity.companyName)} size="lg" label="Logo de l’agence" />
              <span className="min-w-0 break-words text-caption text-fg-subtle">{identity.logoName}</span>
            </div>
            <FileDrop
              key={`logo-${String(resetCount)}`}
              title="Déposer le nouveau logo"
              hint="PNG ou JPG, 2 Mo au maximum. Repris sur les comptes rendus."
              browseLabel="Remplacer le logo"
              rules={IMAGE_RULES}
              file={logo}
              onFileChange={(next) => {
                setLogo(next);
                setLogoError(undefined);
              }}
              error={logoError}
            />
          </SectionCard>
          <SectionCard title="Signature">
            <span className="break-words text-caption text-fg-subtle">{identity.signatureName}</span>
            <FileDrop
              key={`signature-${String(resetCount)}`}
              title="Déposer la nouvelle signature"
              hint="Apposée sur les mandats et les courriers. PNG ou JPG, 2 Mo au maximum."
              browseLabel="Remplacer la signature"
              rules={IMAGE_RULES}
              file={signature}
              onFileChange={(next) => {
                setSignature(next);
                setSignatureError(undefined);
              }}
              error={signatureError}
            />
          </SectionCard>
        </aside>
      </div>
    </SettingsPage>
  );
}
