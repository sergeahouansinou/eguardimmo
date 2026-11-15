"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRules } from "@/components/PasswordRules";
import { useChangeEmail, useChangePassword } from "@/features/auth/queries";
import { changeEmailSchema, changePasswordSchema } from "@/features/auth/schemas";
import type { ChangeEmailValues, ChangePasswordValues } from "@/features/auth/schemas";
import { useNoticeStore } from "./noticeStore";
import { useRequireConfirmation } from "./useConfirmation";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const change = useChangePassword();
  const show = useNoticeStore((state) => state.show);
  const [problem, setProblem] = useState(false);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: "", password: "", confirmation: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setProblem(false);
    try {
      const result = await change.mutateAsync({ current: values.current, password: values.password });
      if (result.status === "invalid_current") {
        form.setError("current", { message: "Mot de passe actuel incorrect." }, { shouldFocus: true });
        return;
      }
      if (result.status === "ok") {
        show({
          tone: "success",
          title: "Mot de passe modifié.",
          message: "Vos autres appareils ont été déconnectés.",
        });
        onOpenChange(false);
        form.reset();
      }
    } catch {
      setProblem(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier le mot de passe" description="Vos autres appareils seront déconnectés.">
        <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-3 p-4">
          {problem ? (
            <FormAlert tone="danger" title="Modification impossible pour le moment." focusOnMount>
              Une erreur est survenue. Réessayez dans un instant.
            </FormAlert>
          ) : null}
          <PasswordField
            label="Mot de passe actuel *"
            placeholder="Votre mot de passe actuel"
            autoComplete="current-password"
            data-autofocus=""
            error={errors.current?.message}
            {...form.register("current")}
          />
          <PasswordField
            label="Nouveau mot de passe *"
            placeholder="12 caractères minimum"
            autoComplete="new-password"
            error={errors.password?.message}
            {...form.register("password")}
          />
          <PasswordField
            label="Confirmation *"
            placeholder="Saisissez-le à nouveau"
            autoComplete="new-password"
            error={errors.confirmation?.message}
            {...form.register("confirmation")}
          />
          <PasswordRules value={password} extraRule="Différent de l’ancien mot de passe" />
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Enregistrer le mot de passe
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const change = useChangeEmail();
  const show = useNoticeStore((state) => state.show);
  const requireConfirmation = useRequireConfirmation();
  const [problem, setProblem] = useState(false);
  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    setProblem(false);
    try {
      const result = await change.mutateAsync(values.email);
      if (result.status === "confirmation_required") {
        onOpenChange(false);
        requireConfirmation(result.needsCode);
        return;
      }
      show({
        tone: "success",
        title: "Vérifiez votre nouvelle adresse.",
        message: "Un message de confirmation vient d’y être envoyé. L’adresse actuelle reste valable tant qu’elle n’est pas confirmée.",
      });
      onOpenChange(false);
      form.reset();
    } catch {
      setProblem(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier l’adresse e-mail" description="Un message de confirmation sera envoyé à la nouvelle adresse.">
        <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-3 p-4">
          {problem ? (
            <FormAlert tone="danger" title="Modification impossible pour le moment." focusOnMount>
              Une erreur est survenue. Réessayez dans un instant.
            </FormAlert>
          ) : null}
          <TextField
            label="Nouvelle adresse e-mail *"
            type="email"
            placeholder="nouvelle.adresse@exemple.fr"
            autoComplete="email"
            inputMode="email"
            data-autofocus=""
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Envoyer le message
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
