"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, RadioGroup, Switch, TextField, useToast } from "@eguardimmo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FieldRow, FormSection } from "@/components/ui/FormSection";
import { FilePicker } from "@/components/ui/FilePicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { agenceRoutes, mandantHref } from "@/espace/routes";
import { mandantFormSchema } from "../forms";
import type { MandantFormValues } from "../forms";
import { MANDANT_TYPE_LABELS } from "../labels";
import { useCreateMandant } from "../queries";
import type { NewMandant } from "../source";

const DEFAULT_VALUES: MandantFormValues = {
  type: "particulier",
  firstName: "",
  lastName: "",
  companyName: "",
  profession: "",
  birthDate: "",
  email: "",
  mobile: "",
  address: "",
  postalCode: "",
  city: "",
  accountHolder: "",
  iban: "",
  inviteByEmail: true,
  reportsByEmail: true,
  idFileName: "",
};

const TYPE_OPTIONS = (Object.keys(MANDANT_TYPE_LABELS) as (keyof typeof MANDANT_TYPE_LABELS)[]).map((value) => ({
  value,
  label: MANDANT_TYPE_LABELS[value],
}));

export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return "Non renseigné";
  const national = digits.startsWith("33") ? digits.slice(2) : digits.replace(/^0/, "");
  return `+33 ${national.slice(0, 1)} •• •• ${national.slice(-4, -2)} ${national.slice(-2)}`;
}

export function toNewMandant(values: MandantFormValues): NewMandant {
  const address = [values.address, `${values.postalCode} ${values.city}`.trim()].filter(Boolean).join(", ");
  return {
    name: values.type === "particulier" ? `${values.firstName} ${values.lastName}` : values.companyName,
    legal: MANDANT_TYPE_LABELS[values.type],
    type: values.type,
    email: values.email,
    phoneMasked: maskPhone(values.mobile),
    address: address || "Non renseignée",
    ibanLast4: values.iban.replace(/\D/g, "").slice(-4),
    ownerSpaceActive: values.inviteByEmail,
    reportsByEmail: values.reportsByEmail,
  };
}

export function MandantFormPage() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateMandant();
  const [failure, setFailure] = useState<string>();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MandantFormValues>({ resolver: zodResolver(mandantFormSchema), defaultValues: DEFAULT_VALUES });
  const type = watch("type");
  const idFileName = watch("idFileName");

  const save = (createMandat: boolean) =>
    handleSubmit(async (values) => {
      setFailure(undefined);
      try {
        const mandant = await create.mutateAsync(toNewMandant(values));
        toast.show({ title: "Mandant enregistré", description: mandant.name });
        router.push(createMandat ? `${agenceRoutes.mandatNew}?mandant=${mandant.id}` : mandantHref(mandant.id));
      } catch (error: unknown) {
        setFailure(error instanceof Error ? error.message : "L'enregistrement a échoué.");
      }
    });

  return (
    <form onSubmit={(event) => { void save(false)(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        crumbs={[{ label: "Mandants", href: agenceRoutes.mandants }, { label: "Nouveau mandant" }]}
        title="Nouveau mandant"
        description="Le propriétaire qui vous confie ses biens. Le mandat se crée ensuite, avec ses honoraires."
      />
      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <FormSection title="Type de mandant">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <RadioGroup label="Type de mandant" options={TYPE_OPTIONS} value={field.value} onValueChange={field.onChange} />
              )}
            />
          </FormSection>

          <FormSection title="Identité">
            {type === "particulier" ? (
              <>
                <FieldRow>
                  <TextField label="Prénom *" placeholder="Claire" {...register("firstName")} {...(errors.firstName?.message ? { error: errors.firstName.message } : {})} />
                  <TextField label="Nom *" placeholder="Vasseur" {...register("lastName")} {...(errors.lastName?.message ? { error: errors.lastName.message } : {})} />
                </FieldRow>
                <FieldRow>
                  <TextField label="Profession" placeholder="Médecin" {...register("profession")} />
                  <TextField label="Date de naissance" type="date" placeholder="14/05/1971" {...register("birthDate")} {...(errors.birthDate?.message ? { error: errors.birthDate.message } : {})} />
                </FieldRow>
              </>
            ) : (
              <TextField
                label="Dénomination *"
                placeholder={type === "societe" ? "SCI Les Mimosas" : "Indivision Vasseur"}
                {...register("companyName")}
                {...(errors.companyName?.message ? { error: errors.companyName.message } : {})}
              />
            )}
          </FormSection>

          <FormSection title="Coordonnées">
            <FieldRow>
              <TextField label="E-mail *" type="email" placeholder="claire.vasseur@example.com" {...register("email")} {...(errors.email?.message ? { error: errors.email.message } : {})} />
              <TextField label="Mobile" type="tel" placeholder="06 12 34 56 78" {...register("mobile")} {...(errors.mobile?.message ? { error: errors.mobile.message } : {})} />
            </FieldRow>
            <TextField label="Adresse" placeholder="18 rue de la Paix" {...register("address")} />
            <FieldRow>
              <TextField label="Code postal" placeholder="69002" inputMode="numeric" {...register("postalCode")} {...(errors.postalCode?.message ? { error: errors.postalCode.message } : {})} />
              <TextField label="Ville" placeholder="Lyon" {...register("city")} />
            </FieldRow>
          </FormSection>

          <FormSection title="Compte de reversement">
            <TextField label="Titulaire du compte *" placeholder="Claire Vasseur" {...register("accountHolder")} {...(errors.accountHolder?.message ? { error: errors.accountHolder.message } : {})} />
            <TextField
              label="IBAN *"
              placeholder="FR76 3000 6000 0112 3456 7890 189"
              autoComplete="off"
              hint="Masqué après l'enregistrement. Les virements ne partent que vers ce compte."
              {...register("iban")}
              {...(errors.iban?.message ? { error: errors.iban.message } : {})}
            />
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <FormSection title="Espace propriétaire">
            <Controller control={control} name="inviteByEmail" render={({ field }) => <Switch label="Inviter le mandant par e-mail" checked={field.value} onCheckedChange={field.onChange} />} />
            <Controller control={control} name="reportsByEmail" render={({ field }) => <Switch label="Comptes rendus par e-mail" checked={field.value} onCheckedChange={field.onChange} />} />
            <p className="text-caption text-fg-subtle">Il ne verra que ses propres biens, ses loyers et ses reversements.</p>
          </FormSection>
          <FormSection title="Pièces">
            <FilePicker
              label="Joindre une pièce d'identité"
              hint="PDF ou image, 10 Mo au maximum"
              accept="application/pdf,image/*"
              maxBytes={10_000_000}
              fileName={idFileName}
              onFileName={(name) => { setValue("idFileName", name); }}
            />
          </FormSection>
          <FormSection title="Après l'enregistrement">
            <Alert tone="info">Aucun encaissement n&apos;est possible avant la signature d&apos;un mandat.</Alert>
          </FormSection>
        </aside>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href={agenceRoutes.mandants}>Annuler</Link>
        </Button>
        <Button type="submit" variant="secondary" loading={create.isPending}>
          Enregistrer le mandant
        </Button>
        <Button
          loading={create.isPending}
          onClick={(event) => { void save(true)(event); }}
        >
          Enregistrer et créer le mandat
        </Button>
      </div>
    </form>
  );
}
