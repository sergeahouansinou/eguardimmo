"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, TextField } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { profileInputSchema } from "../data/inputs";
import type { ProfileInput } from "../data/inputs";
import { errorMessage, useConfie, useUpdateProfile } from "../data/queries";
import type { Profile } from "../data/schemas";
import { confieRoutes } from "../routes";
import { PageHeader } from "../ui/PageHeader";
import { Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { useToast } from "../ui/Toast";
import { IbanDialog } from "./IbanDialog";

export function InformationsModifierScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Modifier profile={data.profile} />}</QueryBoundary>;
}

function Modifier({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { notify } = useToast();
  const update = useUpdateProfile();
  const [failure, setFailure] = useState<string | null>(null);
  const [ibanOpen, setIbanOpen] = useState(false);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      representative: profile.representative,
      street: profile.street,
      postalCode: profile.postalCode,
      city: profile.city,
      phone: profile.phone,
      email: profile.email,
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await update.mutateAsync(values);
      notify("Vos informations sont enregistrées et transmises à l'agence.");
      router.push(confieRoutes.informations);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <>
      <PageHeader
        title="Modifier mes informations"
        crumbs={[{ label: "Mes informations", href: confieRoutes.informations }, { label: "Modifier" }]}
        subtitle="Les changements sont transmis à l'agence après enregistrement."
      />
      <form onSubmit={(event) => { void submit(event); }} noValidate className="contents">
        {failure ? <Alert tone="danger" title="Les informations n'ont pas été enregistrées">{failure}</Alert> : null}
        <Section title="Identité">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField label="Dénomination" placeholder="Ex. : SCI Chevalier" value={profile.denomination} readOnly hint="Modifiable sur justificatif, par l'agence." />
            <TextField label="Représentant *" placeholder="Ex. : Marc Chevalier" error={errors.representative?.message} {...form.register("representative")} />
            <TextField label="SIREN" placeholder="Ex. : 912 345 678" value={profile.siren} readOnly />
          </div>
        </Section>
        <Section title="Compte de reversement">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <TextField label="IBAN" placeholder="Ex. : FR76 3000 6000 0112 3456 7890 189" value={`•••• •••• •••• ${profile.payout.ibanLast4}`} readOnly hint="Un code de confirmation est envoyé par e-mail pour changer d'IBAN." />
            </div>
            <Button variant="secondary" onClick={() => { setIbanOpen(true); }}>Changer d&apos;IBAN</Button>
          </div>
        </Section>
        <Section title="Coordonnées">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField label="Adresse *" placeholder="Ex. : 5 chemin des Vignes" error={errors.street?.message} {...form.register("street")} />
            <TextField label="Code postal *" placeholder="Ex. : 69300" inputMode="numeric" error={errors.postalCode?.message} {...form.register("postalCode")} />
            <TextField label="Ville *" placeholder="Ex. : Caluire-et-Cuire" error={errors.city?.message} {...form.register("city")} />
            <TextField label="Téléphone *" placeholder="Ex. : +33 6 00 00 00 02" type="tel" error={errors.phone?.message} {...form.register("phone")} />
            <TextField label="E-mail *" placeholder="Ex. : marc.chevalier@example.com" type="email" hint="Les comptes rendus et les devis sont notifiés à cette adresse." error={errors.email?.message} {...form.register("email")} />
          </div>
        </Section>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" asChild><Link href={confieRoutes.informations}>Annuler</Link></Button>
          <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer</Button>
        </div>
      </form>
      <IbanDialog open={ibanOpen} onOpenChange={setIbanOpen} email={profile.email} />
    </>
  );
}
