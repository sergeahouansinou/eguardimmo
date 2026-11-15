"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useMemo, useState } from "react";
import { DialogBody, DialogFooter } from "@/features/kit/ActionDialog";
import { FileDrop } from "@/features/kit/FileDrop";
import { useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { splitServerError, toFileMeta } from "@/features/kit/serverValidation";
import { formatDate } from "@/features/shared/dates";
import { DOCUMENT_RULES } from "@/features/shared/files";
import { useRenewPiece } from "./queries";
import { renewFormSchema } from "./schemas";
import type { Piece, RenewForm } from "./schemas";

export function RenewDialog({ piece, open, onOpenChange }: { piece: Piece; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={piece.renewalAction}
        description={`Échéance actuelle : ${formatDate(piece.expiresOn)}. Indiquez la nouvelle référence et la nouvelle échéance.`}
      >
        <RenewForm
          piece={piece}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ piece, onDone }: { piece: Piece; onDone: () => void }) {
  const notify = useNotify();
  const renew = useRenewPiece();
  const schema = useMemo(() => renewFormSchema(piece.expiresOn), [piece.expiresOn]);
  const form = useSchemaForm<RenewForm, RenewForm>(schema, { reference: "", expiresOn: "" });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await renew.mutateAsync({ id: piece.id, ...values, file: file ? toFileMeta(file) : null });
      notify.success(`${piece.title} renouvelée`, `Nouvelle échéance le ${formatDate(values.expiresOn)}.`);
      onDone();
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      if (fields.reference) form.setError("reference", { type: "server", message: fields.reference });
      if (fields.expiresOn) form.setError("expiresOn", { type: "server", message: fields.expiresOn });
      if (fields.file) setFileError(fields.file);
      setFormError(message);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogBody>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField
          label="Nouvelle référence"
          placeholder="Ex. : RCP-2027-00412"
          error={errors.reference?.message}
          {...form.register("reference")}
        />
        <TextField
          label="Nouvelle échéance"
          type="date"
          placeholder="jj/mm/aaaa"
          error={errors.expiresOn?.message}
          {...form.register("expiresOn")}
        />
        <FileDrop
          title="Déposer la nouvelle attestation ici"
          hint="Facultatif. PDF, Word ou image, 25 Mo au maximum."
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
        <Button type="submit" loading={renew.isPending}>
          Enregistrer le renouvellement
        </Button>
      </DialogFooter>
    </form>
  );
}
