"use client";

import { Check } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Icon, TextField } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/FormAlert";
import { useDeleteAccount, useSecurity } from "@/features/auth/queries";
import { DELETE_CONFIRMATION_WORD, deleteAccountSchema } from "@/features/auth/schemas";
import type { DeleteAccountValues } from "@/features/auth/schemas";
import { ROUTES } from "@/lib/routes";
import { ConfirmDialog } from "./ConfirmDialog";
import { PageHead, Section } from "./parts";
import { QueryState } from "./QueryState";
import { useIsConfirmed, useRequireConfirmation } from "./useConfirmation";

const CONSEQUENCES = [
  "Tous vos appareils sont déconnectés.",
  "Vos comptes Google et Apple sont déliés.",
  "Votre e-mail pourra servir à une nouvelle inscription.",
];

export function SuppressionScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const security = useSecurity();
  const remove = useDeleteAccount();
  const requireConfirmation = useRequireConfirmation();
  const confirmed = useIsConfirmed(security.data?.confirmedUntil);
  const confirmedWithCode = useIsConfirmed(security.data?.confirmedWithCodeUntil);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState(false);
  const form = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { confirmation: "" },
  });

  const needsCode = security.data?.twoFactor.enabled === true;
  const recentEnough = needsCode ? confirmedWithCode : confirmed;

  const submit = form.handleSubmit(() => {
    if (!recentEnough) {
      requireConfirmation(needsCode);
      return;
    }
    setOpen(true);
  });

  const confirmDeletion = async () => {
    setProblem(false);
    try {
      const result = await remove.mutateAsync(undefined);
      setOpen(false);
      if (result.status === "deleted") router.replace("/compte-supprime");
      else requireConfirmation(result.needsCode);
    } catch {
      setOpen(false);
      setProblem(true);
    }
  };

  return (
    <>
      <PageHead
        crumbs={[{ label: "Mon compte", href: ROUTES.compte }, { label: "Sécurité", href: ROUTES.compte }, { label: "Supprimer mon compte" }]}
        title="Supprimer mon compte"
        description="Cette action est définitive."
      />
      <QueryState isPending={security.isPending} isError={security.isError} refetch={security.refetch} label="suppression du compte">
        <Section id="d1" title="Avant de continuer">
          <Alert tone="danger" title="Votre compte sera anonymisé.">
            Vous perdez l’accès à tous vos espaces. Les quittances et documents légaux déjà émis sont conservés.
          </Alert>
          <ul className="flex flex-col gap-1 text-body text-fg-muted">
            {CONSEQUENCES.map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <Icon icon={Check} className="text-success-fg" />
                {line}
              </li>
            ))}
          </ul>
          {params.get("confirme") === "1" && recentEnough ? (
            <Alert tone="success" title="Identité confirmée.">
              Vous pouvez supprimer votre compte pendant les 5 prochaines minutes.
            </Alert>
          ) : (
            <Alert tone="info" title="Confirmation récente requise.">
              Confirmez {needsCode ? "un code de double authentification" : "votre mot de passe ou un code"}, moins de 5 minutes avant la suppression.
            </Alert>
          )}
          {problem ? (
            <FormAlert tone="danger" title="Suppression impossible pour le moment." focusOnMount>
              Une erreur est survenue. Votre compte n’a pas été modifié.
            </FormAlert>
          ) : null}
          <form noValidate onSubmit={(event) => { void submit(event); }} className="flex flex-col gap-3">
            <TextField
              label={`Tapez ${DELETE_CONFIRMATION_WORD} pour confirmer *`}
              placeholder={DELETE_CONFIRMATION_WORD}
              autoComplete="off"
              autoCapitalize="characters"
              error={form.formState.errors.confirmation?.message}
              {...form.register("confirmation")}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { router.push(ROUTES.compte); }}>
                Annuler
              </Button>
              <Button type="submit" variant="danger">
                Supprimer définitivement
              </Button>
            </div>
          </form>
        </Section>
      </QueryState>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Supprimer définitivement votre compte ?"
        description="Votre compte sera anonymisé et vous perdrez l’accès à tous vos espaces. Cette action ne peut pas être annulée."
        confirmLabel="Oui, supprimer mon compte"
        tone="danger"
        pending={remove.isPending}
        onConfirm={() => { void confirmDeletion(); }}
      />
    </>
  );
}
