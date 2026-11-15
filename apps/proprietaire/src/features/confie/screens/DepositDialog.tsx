"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ALLOWED_FILE_TYPES, DOCUMENT_CATEGORY_LABELS, documentInputSchema } from "../data/inputs";
import type { DocumentInput } from "../data/inputs";
import { errorMessage, useAddDocument } from "../data/queries";
import { DOCUMENT_CATEGORIES } from "../data/schemas";
import type { Lot } from "../data/schemas";
import { useToast } from "../ui/Toast";

const CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((value) => ({ value, label: DOCUMENT_CATEGORY_LABELS[value] }));

const EMPTY: DocumentInput = { title: "", category: "fiscal", lotId: "", fileType: "application/pdf", fileName: "", sizeKo: 0 };

export interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lots: readonly Lot[];
}

export function DepositDialog({ open, onOpenChange, lots }: DepositDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Déposer un document" description="Le document est transmis à l'agence et classé dans vos documents.">
        <DepositForm lots={lots} onDone={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function DepositForm({ lots, onDone }: { lots: readonly Lot[]; onDone: () => void }) {
  const { notify } = useToast();
  const add = useAddDocument();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<DocumentInput>({ resolver: zodResolver(documentInputSchema), defaultValues: EMPTY });
  const { errors } = form.formState;
  const lotOptions = [{ value: "", label: "Tous les lots" }, ...lots.map((lot) => ({ value: lot.id, label: lot.label }))];

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await add.mutateAsync(values);
      notify(`Document « ${values.title} » déposé.`);
      onDone();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3 p-4">
      {failure ? <Alert tone="danger" title="Le document n'a pas été déposé">{failure}</Alert> : null}
      <TextField label="Titre du document" placeholder="Ex. : Avis de taxe foncière 2026" error={errors.title?.message} data-autofocus {...form.register("title")} />
      <Controller
        control={form.control}
        name="category"
        render={({ field }) => (
          <Select label="Catégorie" placeholder="Choisir une catégorie" options={CATEGORY_OPTIONS} value={field.value} onValueChange={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="lotId"
        render={({ field }) => (
          <Select label="Lot concerné" placeholder="Choisir un lot" options={lotOptions} value={field.value} onValueChange={field.onChange} />
        )}
      />
      <TextField
        type="file"
        label="Fichier"
        placeholder="Choisir un fichier PDF, PNG ou JPEG"
        hint="PDF, PNG ou JPEG, 10 Mo au maximum."
        accept={ALLOWED_FILE_TYPES.join(",")}
        error={errors.fileName?.message ?? errors.fileType?.message ?? errors.sizeKo?.message}
        onChange={(event) => {
          const file = event.target.files?.[0];
          form.setValue("fileName", file?.name ?? "", { shouldValidate: true });
          form.setValue("sizeKo", file ? Math.max(1, Math.ceil(file.size / 1024)) : 0, { shouldValidate: true });
          form.setValue("fileType", file?.type ?? "", { shouldValidate: true });
        }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Déposer</Button>
      </div>
    </form>
  );
}
