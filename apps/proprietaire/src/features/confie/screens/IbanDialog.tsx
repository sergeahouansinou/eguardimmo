"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ibanInputSchema } from "../data/inputs";
import type { IbanInput } from "../data/inputs";
import { errorMessage, useRequestIbanChange } from "../data/queries";
import { useToast } from "../ui/Toast";

export interface IbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export function IbanDialog({ open, onOpenChange, email }: IbanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Changer d'IBAN" description="Un code de confirmation est envoyé par e-mail. Le nouvel IBAN est pris en compte après sa saisie.">
        <IbanForm email={email} onDone={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function IbanForm({ email, onDone }: { email: string; onDone: () => void }) {
  const { notify } = useToast();
  const request = useRequestIbanChange();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<IbanInput>({ resolver: zodResolver(ibanInputSchema), defaultValues: { iban: "" } });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await request.mutateAsync(values);
      notify(`Demande envoyée. Un code de confirmation a été envoyé à ${email}.`);
      onDone();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3 p-4">
      {failure ? <Alert tone="danger" title="La demande n'a pas été envoyée">{failure}</Alert> : null}
      <TextField label="Nouvel IBAN" placeholder="Ex. : FR76 3000 6000 0112 3456 7890 189" autoComplete="off" error={form.formState.errors.iban?.message} data-autofocus {...form.register("iban")} />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Envoyer le code</Button>
      </div>
    </form>
  );
}
