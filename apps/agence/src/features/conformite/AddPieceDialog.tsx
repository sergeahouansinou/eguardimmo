"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { DialogBody, DialogFooter } from "@/features/kit/ActionDialog";
import { FileDrop } from "@/features/kit/FileDrop";
import { FormSelect, useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { splitServerError, toFileMeta } from "@/features/kit/serverValidation";
import { DOCUMENT_RULES } from "@/features/shared/files";
import { useAddPiece } from "./queries";
import { PIECE_TYPES, addPieceFormSchema } from "./schemas";
import type { AddPieceForm } from "./schemas";

const FIELDS: readonly string[] = ["type", "title", "reference", "expiresOn"];

export function AddPieceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ajouter une pièce" description="Déposez le justificatif et indiquez son échéance pour être alerté avant qu’elle n’arrive.">
        <AddPieceForm
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddPieceForm({ onDone }: { onDone: () => void }) {
  const notify = useNotify();
  const add = useAddPiece();
  const form = useSchemaForm<AddPieceForm, AddPieceForm>(addPieceFormSchema, { title: "", reference: "", expiresOn: "" });
  const type = useWatch({ control: form.control, name: "type" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    if (!file) {
      setFileError("Déposez le justificatif de la pièce.");
      return;
    }
    setFormError(null);
    setFileError(undefined);
    try {
      const piece = await add.mutateAsync({ ...values, file: toFileMeta(file) });
      notify.success("Pièce ajoutée", `« ${piece.title} » est suivie dans la conformité.`);
      onDone();
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      Object.entries(fields).forEach(([name, text]) => {
        if (name === "file") setFileError(text);
        else if (FIELDS.includes(name)) form.setError(name as keyof AddPieceForm, { type: "server", message: text });
      });
      setFormError(message);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        if (!file) setFileError("Déposez le justificatif de la pièce.");
        void submit(event);
      }}
    >
      <DialogBody>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <FormSelect
          control={form.control}
          name="type"
          label="Type de pièce"
          placeholder="Choisir un type"
          options={PIECE_TYPES.map((item) => ({ value: item.value, label: item.label }))}
        />
        {type === "autre" ? (
          <TextField
            label="Intitulé de la pièce"
            placeholder="Ex. : Attestation de capacité professionnelle"
            error={errors.title?.message}
            {...form.register("title")}
          />
        ) : null}
        <TextField label="Référence" placeholder="Ex. : KBIS-2026-0412" error={errors.reference?.message} {...form.register("reference")} />
        <TextField
          label="Date d’échéance"
          type="date"
          placeholder="jj/mm/aaaa"
          error={errors.expiresOn?.message}
          {...form.register("expiresOn")}
        />
        <FileDrop
          title="Déposer le justificatif ici"
          hint="PDF, Word ou image. 25 Mo au maximum."
          rules={DOCUMENT_RULES}
          file={file}
          onFileChange={(next) => {
            setFile(next);
            setFileError(undefined);
          }}
          error={fileError}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={add.isPending}>
          Ajouter la pièce
        </Button>
      </DialogFooter>
    </form>
  );
}
