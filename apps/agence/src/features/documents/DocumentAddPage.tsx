"use client";

import { Alert, Button, Select, TextField } from "@eguardimmo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { SectionCard } from "@/components/ui/SectionCard";
import { FileDrop } from "@/features/kit/FileDrop";
import { FormSelect, FormSwitch, FormTextarea, useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { PageFrame } from "@/features/kit/PageFrame";
import { splitServerError, toFileMeta } from "@/features/kit/serverValidation";
import { DOCUMENT_RULES } from "@/features/shared/files";
import { OWNER_OPTIONS, lotOptionsOf } from "./labels";
import { useAddDocument } from "./queries";
import { AGENCY_OWNER, CATEGORIES, NO_LOT_VALUE, addDocumentFormSchema } from "./schemas";
import type { AddDocumentForm } from "./schemas";

const INLINE_FIELDS: readonly string[] = ["ownerId", "lotId", "category", "displayName", "validUntil", "description"];

export function DocumentAddPage() {
  const router = useRouter();
  const notify = useNotify();
  const add = useAddDocument();
  const form = useSchemaForm<AddDocumentForm, AddDocumentForm>(addDocumentFormSchema, {
    ownerId: "",
    lotId: NO_LOT_VALUE,
    displayName: "",
    validUntil: "",
    description: "",
    sharedWithMandant: false,
    sharedWithTenant: false,
  });
  const ownerId = useWatch({ control: form.control, name: "ownerId" });
  const lotId = useWatch({ control: form.control, name: "lotId" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;
  const lotOptions = lotOptionsOf(ownerId);

  const submit = form.handleSubmit(async (values) => {
    if (!file) return;
    setFormError(null);
    try {
      const created = await add.mutateAsync({
        ...values,
        file: toFileMeta(file),
        lotId: values.lotId === NO_LOT_VALUE || values.lotId === "" ? null : values.lotId,
        validUntil: values.validUntil === "" ? null : values.validUntil,
      });
      notify.success("Document déposé", `« ${created.displayName} » est dans la liste des documents.`);
      router.push("/documents");
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      const general: string[] = message ? [message] : [];
      Object.entries(fields).forEach(([name, text]) => {
        if (name === "file") setFileError(text);
        else if (INLINE_FIELDS.includes(name)) form.setError(name as keyof AddDocumentForm, { type: "server", message: text });
        else general.push(text);
      });
      setFormError(general.length > 0 ? general.join(" ") : null);
    }
  });

  return (
    <form
      noValidate
      className="min-w-0"
      onSubmit={(event) => {
        if (!file) setFileError("Déposez le fichier du document.");
        void submit(event);
      }}
    >
      <PageFrame
        crumbs={[{ label: "Documents", href: "/documents" }, { label: "Ajouter un document" }]}
        title="Ajouter un document"
        description="Déposez le fichier, puis rattachez-le à un mandant ou à un bien et choisissez qui peut le voir."
      >
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SectionCard title="Fichier">
              <FileDrop
                title="Déposer le fichier ici"
                hint="PDF, Word ou image. 25 Mo au maximum."
                rules={DOCUMENT_RULES}
                file={file}
                onFileChange={(next) => {
                  setFile(next);
                  setFileError(undefined);
                }}
                error={fileError}
              />
            </SectionCard>
            <SectionCard title="Rattachement">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="ownerId"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Rattaché à *"
                      placeholder="Choisir un mandant ou l’agence"
                      options={OWNER_OPTIONS}
                      value={field.value}
                      error={fieldState.error?.message}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("lotId", NO_LOT_VALUE);
                        if (value === AGENCY_OWNER) form.setValue("sharedWithMandant", false);
                      }}
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="lotId"
                  render={({ field, fieldState }) => (
                    <Select
                      label="Bien"
                      placeholder="Aucun bien"
                      disabled={lotOptions.length === 0}
                      options={[{ value: NO_LOT_VALUE, label: "Aucun bien" }, ...lotOptions]}
                      value={field.value}
                      error={fieldState.error?.message}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === NO_LOT_VALUE) form.setValue("sharedWithTenant", false);
                      }}
                    />
                  )}
                />
                <FormSelect
                  control={form.control}
                  name="category"
                  label="Catégorie *"
                  placeholder="Choisir une catégorie"
                  options={CATEGORIES.map((category) => ({ value: category, label: category }))}
                />
                <TextField
                  label="Nom affiché"
                  placeholder="Ex. : Devis plomberie, Studio 4"
                  hint="Laissé vide, le nom du fichier est repris."
                  error={errors.displayName?.message}
                  {...form.register("displayName")}
                />
              </div>
              <TextField
                label="Date de validité"
                type="date"
                placeholder="jj/mm/aaaa"
                hint="Une alerte est envoyée avant cette date."
                error={errors.validUntil?.message}
                {...form.register("validUntil")}
              />
              <FormTextarea
                control={form.control}
                name="description"
                label="Description"
                placeholder="Ex. : Devis de Plomberie Sanvi pour la fuite sous l’évier, 380 € TTC."
              />
            </SectionCard>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <SectionCard title="Partage">
              <FormSwitch
                control={form.control}
                name="sharedWithMandant"
                label="Visible par le mandant"
                disabled={ownerId === AGENCY_OWNER}
                hint={ownerId === AGENCY_OWNER ? "Un document de l’agence n’a pas de mandant." : undefined}
              />
              <FormSwitch
                control={form.control}
                name="sharedWithTenant"
                label="Visible par le locataire"
                disabled={lotId === NO_LOT_VALUE}
                hint={lotId === NO_LOT_VALUE ? "Choisissez un bien pour le partager avec le locataire." : undefined}
              />
              <p className="text-caption text-fg-subtle">Un document interne reste visible par l’équipe de l’agence seulement.</p>
            </SectionCard>
          </aside>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              router.push("/documents");
            }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={add.isPending}>
            Déposer le document
          </Button>
        </div>
      </PageFrame>
    </form>
  );
}
