"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Icon, TextField } from "@eguardimmo/ui";
import { MailCheck, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Section } from "@/features/confie/ui/Section";
import { ActionFailure } from "../security/ActionFailure";
import { CODE_LENGTH, codeFormSchema, emailFormSchema } from "./forms";
import type { CodeValues, EmailValues } from "./forms";
import { forgetPendingEmail, rememberPendingEmail, usePendingEmail } from "./pendingEmail";
import type { PendingEmail } from "./pendingEmail";
import { useCancelEmailChange, useConfirmEmailChange, useRequestEmailChange } from "./queries";
import type { AccountProfile } from "./schemas";

export function EmailChangeCard({ profile }: { profile: AccountProfile }) {
  const pending = usePendingEmail();
  const [changed, setChanged] = useState<string | null>(null);
  return (
    <Section title="Adresse e-mail">
      <p className="text-body text-fg-muted">
        Adresse actuelle : <b className="text-fg">{profile.email}</b>. Un changement est confirmé par un code envoyé à la nouvelle adresse.
      </p>
      {changed === null ? null : <Alert tone="success" title="Adresse e-mail modifiée">{`Votre adresse est désormais ${changed}.`}</Alert>}
      {pending === undefined ? null : pending === null ? (
        <RequestForm profile={profile} />
      ) : (
        <ConfirmForm pending={pending} onConfirmed={setChanged} />
      )}
    </Section>
  );
}

function RequestForm({ profile }: { profile: AccountProfile }) {
  const request = useRequestEmailChange();
  const { register, handleSubmit, formState, setError } = useForm<EmailValues>({ resolver: zodResolver(emailFormSchema), defaultValues: { email: "" } });
  const submit = handleSubmit((values) => {
    const email = values.email.trim();
    if (email.toLowerCase() === profile.email.toLowerCase()) {
      setError("email", { message: "Cette adresse est déjà celle de votre compte." });
      return;
    }
    request.mutate(email, { onSuccess: (minutes) => { rememberPendingEmail(email, minutes); } });
  });
  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      {request.isError ? <ActionFailure error={request.error} title="Le code n’a pas pu être envoyé" reauth="password" /> : null}
      <TextField label="Nouvelle adresse e-mail *" placeholder="Ex. : aline.dossou@example.com" type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
      <div className="flex justify-end">
        <Button type="submit" loading={request.isPending}>
          <Icon icon={Send} />
          Recevoir un code
        </Button>
      </div>
    </form>
  );
}

function ConfirmForm({ pending, onConfirmed }: { pending: PendingEmail; onConfirmed: (email: string) => void }) {
  const confirm = useConfirmEmailChange();
  const cancel = useCancelEmailChange();
  const resend = useRequestEmailChange();
  const { register, handleSubmit, formState, reset } = useForm<CodeValues>({ resolver: zodResolver(codeFormSchema), defaultValues: { code: "" } });
  const expiresAt = new Date(pending.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const submit = handleSubmit((values) => {
    confirm.mutate(values.code.trim(), {
      onSuccess: () => {
        onConfirmed(pending.email);
        forgetPendingEmail();
      },
    });
  });
  const abandon = () => {
    cancel.mutate(undefined, { onSuccess: forgetPendingEmail });
  };
  const again = () => {
    resend.mutate(pending.email, {
      onSuccess: (minutes) => {
        reset();
        rememberPendingEmail(pending.email, minutes);
      },
    });
  };
  const failure = confirm.isError ? confirm.error : cancel.isError ? cancel.error : resend.isError ? resend.error : null;
  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      <Alert tone="info" title="Changement en attente de confirmation">
        <span className="flex items-start gap-1.5">
          <Icon icon={MailCheck} size={16} className="mt-0.5 shrink-0" />
          {`Un code à ${String(CODE_LENGTH)} chiffres a été envoyé à ${pending.email}. Il expire vers ${expiresAt}. Votre adresse actuelle reste valable jusque-là.`}
        </span>
      </Alert>
      {failure === null ? null : <ActionFailure error={failure} title="L’opération n’a pas abouti" reauth="password" />}
      <TextField label="Code de confirmation *" placeholder="Ex. : 123456" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH} error={formState.errors.code?.message} {...register("code")} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" loading={cancel.isPending} onClick={abandon}>
          Annuler le changement
        </Button>
        <Button variant="secondary" loading={resend.isPending} onClick={again}>
          Renvoyer un code
        </Button>
        <Button type="submit" loading={confirm.isPending}>
          Confirmer l’adresse
        </Button>
      </div>
    </form>
  );
}
