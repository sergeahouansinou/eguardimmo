"use client";

import { Alert, Button, Card, CardHeader, CardTitle, Icon, TextField } from "@eguardimmo/ui";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWatch } from "react-hook-form";
import { useState } from "react";
import { FormCheckCards, FormRadioCards, FormSegmented, FormTextarea, LinkButton, PageFrame, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { DemoServerError } from "@/features/shared/errors";
import { MANDANTS } from "@/features/shared/directory";
import { useInviteMember } from "./hooks";
import { INVITABLE_ROLE_IDS, ROLE_LABELS, ROLE_SUMMARIES } from "./rights";
import { RolePanel } from "./RolePanel";
import { inviteInputSchema } from "./schemas";
import type { InviteInput } from "./schemas";

const ROLE_OPTIONS = INVITABLE_ROLE_IDS.map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_SUMMARIES[role] }));
const MANDANT_OPTIONS = MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name, description: mandant.kind }));
const MODE_OPTIONS = [
  { value: "all", label: "Tous les mandants" },
  { value: "chosen", label: "Mandants choisis" },
];

const DEFAULTS: InviteInput = {
  firstName: "",
  lastName: "",
  email: "",
  role: "gestionnaire",
  portfolioMode: "all",
  mandantIds: [],
  message: "",
};

interface FormFailure {
  message: string;
  seatLimit: boolean;
}

export function InvitationPage() {
  const router = useRouter();
  const notify = useNotify();
  const invite = useInviteMember();
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const { register, control, handleSubmit, setError, formState } = useSchemaForm(inviteInputSchema, DEFAULTS);
  const role = useWatch({ control, name: "role" });
  const mode = useWatch({ control, name: "portfolioMode" });
  const { errors } = formState;

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await invite.mutateAsync(values);
      notify.success("Invitation envoyée", values.email);
      router.push("/equipe");
    } catch (error) {
      const message = applyServerError(setError, error);
      if (message) setFailure({ message, seatLimit: error instanceof DemoServerError && error.code === "seat_limit" });
    }
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="min-w-0">
      <PageFrame
        crumbs={[{ label: "Équipe", href: "/equipe" }, { label: "Inviter un collaborateur" }]}
        title="Inviter un collaborateur"
        description="Le collaborateur reçoit un lien valable 7 jours pour créer son accès."
      >
        {failure ? (
          <Alert tone="danger">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {failure.message}
              {failure.seatLimit ? (
                <LinkButton href="/compte/abonnement" variant="secondary" size="sm">
                  Voir les formules
                </LinkButton>
              ) : null}
            </span>
          </Alert>
        ) : null}
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card role="region" aria-label="Collaborateur">
              <CardHeader>
                <CardTitle as="h2">Collaborateur</CardTitle>
              </CardHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Prénom *" placeholder="Ex. : Thomas" autoComplete="off" error={errors.firstName?.message} {...register("firstName")} />
                <TextField label="Nom *" placeholder="Ex. : Girard" autoComplete="off" error={errors.lastName?.message} {...register("lastName")} />
              </div>
              <TextField
                label="E-mail *"
                type="email"
                placeholder="Ex. : thomas.girard@example.com"
                autoComplete="off"
                hint="L'invitation est envoyée à cette adresse."
                error={errors.email?.message}
                {...register("email")}
              />
            </Card>
            <Card role="region" aria-label="Rôle">
              <FormRadioCards control={control} name="role" legend="Rôle *" options={ROLE_OPTIONS} />
            </Card>
            <Card role="region" aria-label="Mandants confiés">
              <CardHeader>
                <CardTitle as="h2">Mandants confiés</CardTitle>
              </CardHeader>
              {role === "gestionnaire" ? (
                <>
                  <FormSegmented control={control} name="portfolioMode" label="Mandants confiés" options={MODE_OPTIONS} />
                  {mode === "chosen" ? <FormCheckCards control={control} name="mandantIds" legend="Mandants" options={MANDANT_OPTIONS} /> : null}
                  <p className="text-caption text-fg-subtle">Il ne voit que les biens, locataires et documents de ces mandants.</p>
                </>
              ) : (
                <p className="text-body text-fg-muted">Ce rôle voit tout le portefeuille, dans la limite de ses droits.</p>
              )}
            </Card>
            <Card role="region" aria-label="Message">
              <CardHeader>
                <CardTitle as="h2">Message</CardTitle>
              </CardHeader>
              <FormTextarea
                control={control}
                name="message"
                label="Message personnel"
                placeholder="Ex. : Bonjour Thomas, voici ton accès pour suivre les mandats de la SCI Les Acacias."
              />
            </Card>
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <RolePanel role={role} />
          </aside>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              router.push("/equipe");
            }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={invite.isPending}>
            <Icon icon={Send} />
            Envoyer l'invitation
          </Button>
        </div>
      </PageFrame>
    </form>
  );
}
