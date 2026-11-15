"use client";

import { Alert, Button, Card, CardHeader, CardTitle, IconButton, TextField } from "@eguardimmo/ui";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import type { SubmitEventHandler } from "react";
import { FileDrop, FormSelect, FormSwitch, FormTextarea, LinkButton, PageFrame, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { WORKS_CEILING_MINOR } from "@/features/shared/agencyDefaults";
import { LOTS, mandantById } from "@/features/shared/directory";
import { PHOTO_RULES } from "@/features/shared/files";
import { formatMoney, parseMoney } from "@/features/shared/money";
import { CONTRACTORS } from "./contractors";
import { PRIORITY_LABELS } from "./labels";
import { useCreateIntervention } from "./queries";
import { PRIORITIES, interventionFormSchema } from "./schemas";
import type { InterventionFormInput, InterventionFormValues } from "./schemas";

const MAX_PHOTOS = 5;

const LOT_OPTIONS = LOTS.map((lot) => ({
  value: lot.id,
  label: `${lot.label}, ${mandantById(lot.mandantId)?.name ?? ""}`,
  description: lot.address,
}));

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

const CONTRACTOR_OPTIONS = [{ value: "", label: "À désigner" }, ...CONTRACTORS.map((item) => ({ value: item.name, label: item.name }))];

const DEFAULTS: InterventionFormInput = {
  subject: "",
  lotId: "",
  priority: "normale",
  dueOn: "",
  contractor: "",
  description: "",
  notifyTenant: true,
  notifyMandant: true,
  estimated: "",
};

export function InterventionFormPage() {
  const router = useRouter();
  const notify = useNotify();
  const create = useCreateIntervention();
  const form = useSchemaForm<InterventionFormInput, InterventionFormValues>(interventionFormSchema, DEFAULTS);
  const [photos, setPhotos] = useState<readonly File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const estimated = useWatch({ control: form.control, name: "estimated" });
  const estimatedMinor = parseMoney(estimated);
  const needsApproval = estimatedMinor !== null && estimatedMinor > WORKS_CEILING_MINOR;
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const created = await create.mutateAsync({
        subject: values.subject,
        lotId: values.lotId,
        priority: values.priority,
        dueOn: values.dueOn,
        contractor: values.contractor,
        description: values.description,
        notifyTenant: values.notifyTenant,
        notifyMandant: values.notifyMandant,
        estimatedMinor: parseMoney(values.estimated),
        photos: photos.map((file) => file.name),
      });
      notify.success("Intervention créée", needsApproval ? "L'accord du mandant a été demandé." : `« ${values.subject} » est ouverte.`);
      router.push(`/interventions/${created.id}`);
    } catch (error) {
      setFormError(applyServerError(form.setError, error));
    }
  });

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void onSubmit(event);
  };

  return (
    <PageFrame
      crumbs={[{ label: "Interventions", href: "/interventions" }, { label: "Nouvelle intervention" }]}
      title="Nouvelle intervention"
      description="Une intervention se rattache à un bien sous mandat. Le locataire est prévenu à la planification."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card role="region" aria-label="Intervention">
            <CardHeader>
              <CardTitle as="h2">Intervention</CardTitle>
            </CardHeader>
            <TextField label="Sujet *" placeholder="Fuite sous l'évier" error={errors.subject?.message} {...form.register("subject")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormSelect
                control={form.control}
                name="lotId"
                label="Bien *"
                placeholder="Choisir un bien, ex. Studio 4"
                options={LOT_OPTIONS}
                searchable
                searchPlaceholder="Rechercher un bien"
              />
              <FormSelect control={form.control} name="priority" label="Priorité *" placeholder="Choisir une priorité" options={PRIORITY_OPTIONS} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Échéance" type="date" placeholder="JJ/MM/AAAA" error={errors.dueOn?.message} {...form.register("dueOn")} />
              <FormSelect control={form.control} name="contractor" label="Intervenant" placeholder="Choisir un intervenant" options={CONTRACTOR_OPTIONS} />
            </div>
            <FormTextarea
              control={form.control}
              name="description"
              label="Description"
              placeholder="Fuite sous le lavabo de la cuisine, le dessous du meuble est humide."
            />
            <FormSwitch control={form.control} name="notifyTenant" label="Prévenir le locataire par e-mail" />
            <FormSwitch control={form.control} name="notifyMandant" label="Prévenir le mandant" />
          </Card>
          <div className="flex min-w-0 flex-col gap-3">
            <Card role="region" aria-label="Accord du mandant">
              <CardHeader>
                <CardTitle as="h2">Accord du mandant</CardTitle>
              </CardHeader>
              <TextField
                label="Montant estimé"
                placeholder="380,00"
                inputMode="decimal"
                error={errors.estimated?.message}
                hint={`Au-delà de ${formatMoney(WORKS_CEILING_MINOR)}, l'accord du mandant est demandé avant l'intervention.`}
                {...form.register("estimated")}
              />
              {needsApproval ? (
                <Alert tone="warning" title="Accord du mandant demandé">
                  Ce montant dépasse le plafond de {formatMoney(WORKS_CEILING_MINOR)} : l'intervention attendra l'accord du mandant.
                </Alert>
              ) : null}
            </Card>
            <Card role="region" aria-label="Photos">
              <CardHeader>
                <CardTitle as="h2">Photos</CardTitle>
              </CardHeader>
              {photos.length < MAX_PHOTOS ? (
                <FileDrop
                  title="Ajouter des photos"
                  hint="JPG ou PNG, 10 Mo au maximum"
                  rules={PHOTO_RULES}
                  file={null}
                  browseLabel="Choisir des fichiers"
                  onFileChange={(file) => {
                    if (file) setPhotos((current) => [...current, file]);
                  }}
                />
              ) : (
                <p className="text-caption text-fg-subtle">{MAX_PHOTOS} photos au maximum.</p>
              )}
              {photos.length > 0 ? (
                <ul aria-label="Photos ajoutées" className="flex flex-col gap-1.5">
                  {photos.map((photo, index) => (
                    <li key={`${photo.name}-${String(index)}`} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-body">{photo.name}</span>
                      <IconButton
                        label={`Retirer la photo ${photo.name}`}
                        icon={X}
                        onClick={() => {
                          setPhotos((current) => current.filter((_, position) => position !== index));
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href="/interventions" variant="ghost">
            Annuler
          </LinkButton>
          <Button type="submit" loading={create.isPending}>
            Créer l'intervention
          </Button>
        </div>
      </form>
    </PageFrame>
  );
}
