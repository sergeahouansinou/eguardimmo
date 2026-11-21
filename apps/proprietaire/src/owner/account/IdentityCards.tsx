"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Icon, TextField } from "@eguardimmo/ui";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Section } from "@/features/confie/ui/Section";
import { ActionFailure } from "../security/ActionFailure";
import { PHONE_MAX, nameFormSchema, phoneFormSchema } from "./forms";
import type { NameValues, PhoneValues } from "./forms";
import { useUpdateName, useUpdatePhone } from "./queries";
import type { AccountProfile } from "./schemas";

export function NameCard({ profile }: { profile: AccountProfile }) {
  const update = useUpdateName();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState, reset } = useForm<NameValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name: profile.name } });
  const submit = handleSubmit((values) => {
    setSaved(false);
    update.mutate(values.name, {
      onSuccess: (next) => {
        reset({ name: next.name });
        setSaved(true);
      },
    });
  });
  return (
    <Section title="Nom">
      <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
        {update.isError ? <ActionFailure error={update.error} title="Le nom n’a pas pu être enregistré" reauth="password" /> : null}
        {saved ? <Alert tone="success" title="Nom enregistré">Votre nom a été mis à jour pour tous vos espaces eGuardImmo.</Alert> : null}
        <TextField label="Nom complet *" placeholder="Ex. : Aline Dossou" autoComplete="name" error={formState.errors.name?.message} {...register("name")} />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            <Icon icon={Check} />
            Enregistrer le nom
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function PhoneCard({ profile }: { profile: AccountProfile }) {
  const update = useUpdatePhone();
  const [saved, setSaved] = useState<string | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<PhoneValues>({ resolver: zodResolver(phoneFormSchema), defaultValues: { phone: profile.phone ?? "" } });
  const submit = handleSubmit((values) => {
    setSaved(null);
    const phone = values.phone.trim() === "" ? null : values.phone.trim();
    update.mutate(phone, {
      onSuccess: (next) => {
        reset({ phone: next.phone ?? "" });
        setSaved(phone === null ? "Téléphone retiré" : "Téléphone enregistré");
      },
    });
  });
  return (
    <Section title="Téléphone">
      <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
        {update.isError ? <ActionFailure error={update.error} title="Le téléphone n’a pas pu être enregistré" reauth="password" /> : null}
        {saved === null ? null : <Alert tone="success" title={saved}>Votre compte a été mis à jour.</Alert>}
        <TextField
          label="Téléphone (facultatif)"
          placeholder="Ex. : +33 6 12 34 56 78"
          type="tel"
          autoComplete="tel"
          maxLength={PHONE_MAX}
          hint="Format international. Laissez vide pour retirer votre numéro."
          error={formState.errors.phone?.message}
          {...register("phone")}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            <Icon icon={Check} />
            Enregistrer le téléphone
          </Button>
        </div>
      </form>
    </Section>
  );
}
