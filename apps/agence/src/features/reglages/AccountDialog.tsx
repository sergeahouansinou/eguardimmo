"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { DialogBody, DialogFooter } from "@/features/kit/ActionDialog";
import { useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { splitServerError } from "@/features/kit/serverValidation";
import { useUpdateAccount } from "./queries";
import { accountFormSchema } from "./schemas";
import type { AccountForm, Finances } from "./schemas";

interface AccountDialogProps {
  account: Finances["account"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDialog({ account, open, onOpenChange }: AccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Modifier le compte des mandants"
        description="Compte séquestre, distinct de celui de l’agence. Seuls les quatre derniers chiffres de l’IBAN sont conservés."
      >
        <AccountFormBody
          account={account}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AccountFormBody({ account, onDone }: { account: Finances["account"]; onDone: () => void }) {
  const notify = useNotify();
  const update = useUpdateAccount();
  const form = useSchemaForm<AccountForm, AccountForm>(accountFormSchema, { iban: "", bank: account.bank, holder: account.holder });
  const [formError, setFormError] = useState<string | null>(null);
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync(values);
      notify.success("Compte des mandants modifié", "Un nouveau rapprochement bancaire est à faire.");
      onDone();
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      (["iban", "bank", "holder"] as const).forEach((name) => {
        const text = fields[name];
        if (text) form.setError(name, { type: "server", message: text });
      });
      setFormError(message);
    }
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        void submit(event);
      }}
    >
      <DialogBody>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField
          label="IBAN"
          placeholder="Ex. : FR76 3000 6000 0112 3456 7890 189"
          autoComplete="off"
          spellCheck={false}
          error={errors.iban?.message}
          {...form.register("iban")}
        />
        <TextField label="Banque" placeholder="Ex. : Banque du Canal" error={errors.bank?.message} {...form.register("bank")} />
        <TextField label="Titulaire" placeholder="Ex. : Cabinet Delmas Immobilier" error={errors.holder?.message} {...form.register("holder")} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={update.isPending}>
          Enregistrer le compte
        </Button>
      </DialogFooter>
    </form>
  );
}
