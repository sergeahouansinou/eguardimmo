"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, TextField } from "@eguardimmo/ui";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { CheckboxField, TermsLabel } from "@/components/CheckboxField";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRules } from "@/components/PasswordRules";
import { AltLine } from "@/components/TextLink";
import { registerAgenceSchema, registerBailleurSchema } from "@/features/auth/schemas";
import type { RegisterAgenceValues, RegisterBailleurValues } from "@/features/auth/schemas";
import { ChangeProfileLink, RegisterFrame, useRegistration } from "./RegisterFrame";

function PasswordBlock({ registration, error, value }: { registration: UseFormRegisterReturn; error?: string; value: string }) {
  return (
    <>
      <PasswordField
        label="Mot de passe *"
        placeholder="12 caractères minimum"
        autoComplete="new-password"
        error={error}
        {...registration}
      />
      <PasswordRules value={value} />
    </>
  );
}

function PersonRegister({
  profile,
  title,
  description,
  submitLabel,
  placeholders,
  footer,
}: {
  profile: "bailleur" | "voyageur";
  title: string;
  description: string;
  submitLabel: string;
  placeholders: { firstName: string; lastName: string; email: string };
  footer: "profil" | "sebook";
}) {
  const { problem, submit, social, busy } = useRegistration(profile);
  const form = useForm<RegisterBailleurValues>({
    resolver: zodResolver(registerBailleurSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", acceptTerms: false },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const { setFocus } = form;
  useEffect(() => {
    setFocus("firstName");
  }, [setFocus]);
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit((values) =>
    submit({ profile, firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password }),
  );
  return (
    <RegisterFrame
      title={title}
      description={description}
      problem={problem}
      busy={busy}
      profile={profile}
      onSocial={social}
      footer={footer === "profil" ? <ChangeProfileLink /> : <AltLine>Vous reviendrez sur SeBook une fois le compte créé.</AltLine>}
    >
      <form noValidate onSubmit={(event) => { void onSubmit(event); }} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Prénom *" placeholder={placeholders.firstName} autoComplete="given-name" error={errors.firstName?.message} {...form.register("firstName")} />
          <TextField label="Nom *" placeholder={placeholders.lastName} autoComplete="family-name" error={errors.lastName?.message} {...form.register("lastName")} />
        </div>
        <TextField label="E-mail *" type="email" placeholder={placeholders.email} autoComplete="username" inputMode="email" error={errors.email?.message} {...form.register("email")} />
        <PasswordBlock registration={form.register("password")} error={errors.password?.message} value={password} />
        <CheckboxField label={<TermsLabel />} error={errors.acceptTerms?.message} {...form.register("acceptTerms")} />
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          {submitLabel}
        </Button>
      </form>
    </RegisterFrame>
  );
}

export function BailleurRegister() {
  return (
    <PersonRegister
      profile="bailleur"
      title="Créer mon espace bailleur"
      description="Gratuit, sans carte bancaire."
      submitLabel="Créer mon espace"
      placeholders={{ firstName: "Marc", lastName: "Chevalier", email: "marc.chevalier@exemple.fr" }}
      footer="profil"
    />
  );
}

export function VoyageurRegister() {
  return (
    <PersonRegister
      profile="voyageur"
      title="Créer mon compte voyageur"
      description="Pour réserver et suivre vos séjours sur SeBook."
      submitLabel="Créer mon compte"
      placeholders={{ firstName: "Camille", lastName: "Perrin", email: "camille.perrin@exemple.fr" }}
      footer="sebook"
    />
  );
}

export function AgenceRegister() {
  const { problem, submit, social, busy } = useRegistration("agence");
  const form = useForm<RegisterAgenceValues>({
    resolver: zodResolver(registerAgenceSchema),
    defaultValues: { agencyName: "", siren: "", email: "", password: "", acceptTerms: false },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const { setFocus } = form;
  useEffect(() => {
    setFocus("agencyName");
  }, [setFocus]);
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit((values) =>
    submit({ profile: "agence", agencyName: values.agencyName, siren: values.siren.replace(/\s/g, ""), email: values.email, password: values.password }),
  );
  return (
    <RegisterFrame
      title="Créer mon agence"
      description="Essai gratuit d’un mois, sans carte bancaire ni validation préalable."
      problem={problem}
      busy={busy}
      profile="agence"
      onSocial={social}
      footer={<ChangeProfileLink />}
    >
      <form noValidate onSubmit={(event) => { void onSubmit(event); }} className="flex flex-col gap-4">
        <TextField label="Nom de l’agence *" placeholder="Cabinet Delmas Immobilier" autoComplete="organization" error={errors.agencyName?.message} {...form.register("agencyName")} />
        <TextField label="SIREN *" placeholder="123 456 789" inputMode="numeric" autoComplete="off" error={errors.siren?.message} {...form.register("siren")} />
        <TextField label="E-mail du responsable *" type="email" placeholder="sophie.delmas@agence.fr" autoComplete="username" inputMode="email" error={errors.email?.message} {...form.register("email")} />
        <PasswordBlock registration={form.register("password")} error={errors.password?.message} value={password} />
        <CheckboxField label={<TermsLabel />} error={errors.acceptTerms?.message} {...form.register("acceptTerms")} />
        <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
          Créer mon agence
        </Button>
      </form>
    </RegisterFrame>
  );
}
