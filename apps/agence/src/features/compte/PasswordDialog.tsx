import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useMemo, useState } from "react";
import type { SubmitEvent } from "react";
import { DialogBody, DialogFooter, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { useChangePassword } from "./hooks";
import { passwordChangeSchema } from "./securitySchemas";
import type { PasswordChangeInput } from "./securitySchemas";

const EMPTY: PasswordChangeInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function PasswordDialog({ minLength, onClose }: { minLength: number; onClose: () => void }) {
  const notify = useNotify();
  const change = useChangePassword();
  const schema = useMemo(() => passwordChangeSchema(minLength), [minLength]);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useSchemaForm(schema, EMPTY);
  const { errors } = formState;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await change.mutateAsync(values);
      notify.success("Mot de passe modifié");
      onClose();
    } catch (error) {
      setFormError(applyServerError(setError, error));
    }
  });

  const handleSubmitEvent = (event: SubmitEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Modifier le mot de passe" description={`L'agence impose au moins ${String(minLength)} caractères.`}>
        <form onSubmit={handleSubmitEvent} noValidate>
          <DialogBody>
            <TextField
              label="Mot de passe actuel"
              type="password"
              placeholder="Votre mot de passe actuel"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />
            <TextField
              label="Nouveau mot de passe"
              type="password"
              placeholder={`Au moins ${String(minLength)} caractères`}
              autoComplete="new-password"
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
            <TextField
              label="Confirmer le nouveau mot de passe"
              type="password"
              placeholder="Saisissez-le à nouveau"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            {formError ? <Alert tone="danger">{formError}</Alert> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={change.isPending}>
              Modifier le mot de passe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
