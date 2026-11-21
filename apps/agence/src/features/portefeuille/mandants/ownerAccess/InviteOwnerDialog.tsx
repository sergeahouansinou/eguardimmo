"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Checkbox, Dialog, DialogContent, Select, TextField } from "@eguardimmo/ui";
import Link from "next/link";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { agenceRoutes } from "@/espace/routes";
import { describeOwnerAccessFailure } from "./errors";
import { OWNER_ROLE_HINTS, OWNER_ROLE_LABELS, rolesFor } from "./labels";
import type { MandantKind } from "./labels";
import { PairingCodeView } from "./PairingCodeView";
import { useInviteOwner, useOwnerContacts } from "./queries";
import { NO_PERSON, inviteFormSchema, toInvitePayload } from "./schemas";
import type { InviteFormValues } from "./schemas";

export interface InviteOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  mandantName: string;
  mandantKind: MandantKind;
}

export function InviteOwnerDialog({ open, onOpenChange, partyId, mandantName, mandantKind }: InviteOwnerDialogProps) {
  const invite = useInviteOwner(partyId);
  const issued = invite.data;

  const close = (next: boolean) => {
    if (next) return;
    invite.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-h-[calc(100dvh-32px)] overflow-y-auto"
        title={issued ? "Code d’appariement" : "Inviter à l’espace propriétaire"}
        description={issued ? `Invitation envoyée pour ${mandantName}.` : `Donnez accès à ${mandantName} à son espace propriétaire. Le mandant sera averti à son adresse principale.`}
        {...(issued ? { onInteractOutside: (event: Event) => { event.preventDefault(); } } : {})}
      >
        {issued ? <PairingCodeView issued={issued} onDone={() => { close(false); }} /> : <InviteForm invite={invite} mandantKind={mandantKind} partyId={partyId} onCancel={() => { close(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ invite, mandantKind, partyId, onCancel }: { invite: ReturnType<typeof useInviteOwner>; mandantKind: MandantKind; partyId: string; onCancel: () => void }) {
  const roles = rolesFor(mandantKind);
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { role: roles[0] ?? "holder", personPartyId: "", email: "", identityVerified: false, powersVerified: false },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const needsPerson = role !== "holder";
  const contacts = useOwnerContacts(needsPerson);
  const failure = invite.isError ? describeOwnerAccessFailure(invite.error) : null;
  const { errors } = form.formState;

  useEffect(() => {
    if (failure?.field) form.setError(failure.field, { message: failure.message });
  }, [failure, form]);

  const people = (contacts.data ?? []).filter((contact) => contact.kind === "person" && contact.id !== partyId);
  const personOptions = [
    ...(role === "representative" ? [{ value: NO_PERSON, label: "Aucune fiche, e-mail saisi ci-dessous" }] : []),
    ...people.map((contact) => ({ value: contact.id, label: contact.name })),
  ];

  const submit = form.handleSubmit((values) => {
    invite.mutate(toInvitePayload(values));
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3 p-4">
      {failure && !failure.field ? (
        <Alert tone="danger" title="Invitation impossible">
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {failure.kind === "twoFactorRequired" || failure.kind === "reauthenticationRequired" ? (
              <Button asChild variant="link" size="sm">
                <Link href={agenceRoutes.compteSecurite}>Ouvrir Connexion et sécurité</Link>
              </Button>
            ) : null}
          </span>
        </Alert>
      ) : null}
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <Select
            label="Rôle du compte invité"
            placeholder="Choisissez un rôle"
            value={field.value}
            onValueChange={field.onChange}
            hint={OWNER_ROLE_HINTS[field.value]}
            options={roles.map((value) => ({ value, label: OWNER_ROLE_LABELS[value] }))}
            {...(errors.role?.message ? { error: errors.role.message } : {})}
          />
        )}
      />
      {needsPerson ? (
        <Controller
          control={form.control}
          name="personPartyId"
          render={({ field }) => (
            <Select
              label={role === "co_owner" ? "Fiche du co-indivisaire" : "Fiche du représentant (facultatif)"}
              placeholder="Choisissez une personne"
              value={field.value}
              onValueChange={field.onChange}
              searchable
              options={personOptions}
              {...(contacts.isError ? { error: "Les contacts n’ont pas pu être chargés. Fermez puis rouvrez la fenêtre." } : errors.personPartyId?.message ? { error: errors.personPartyId.message } : {})}
            />
          )}
        />
      ) : null}
      <TextField
        label="Adresse e-mail à inviter (facultatif)"
        placeholder="awa.dossou@example.com"
        type="email"
        autoComplete="off"
        hint="Laissez vide pour utiliser l’adresse principale de la fiche."
        {...form.register("email")}
        {...(errors.email?.message ? { error: errors.email.message } : {})}
      />
      <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
        <legend className="px-1 text-caption text-fg-muted">Attestations de l’agence</legend>
        <p className="text-caption text-fg-subtle">Ces cases sont une déclaration de votre agence : elles engagent sa responsabilité et sont conservées dans le journal d’audit.</p>
        <Checkbox label="J’atteste avoir vérifié l’identité du mandant" {...form.register("identityVerified")} aria-invalid={errors.identityVerified ? true : undefined} />
        {errors.identityVerified?.message ? <p role="alert" className="text-caption text-fg-danger">{errors.identityVerified.message}</p> : null}
        {role === "representative" ? (
          <>
            <Checkbox label="J’atteste avoir vérifié les pouvoirs du représentant" {...form.register("powersVerified")} aria-invalid={errors.powersVerified ? true : undefined} />
            {errors.powersVerified?.message ? <p role="alert" className="text-caption text-fg-danger">{errors.powersVerified.message}</p> : null}
          </>
        ) : null}
      </fieldset>
      <p className="text-caption text-fg-subtle">Un code d’appariement à 6 chiffres vous sera remis à l’écran, une seule fois. L’invitation par e-mail ne le contient jamais.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={invite.isPending}>Envoyer l’invitation</Button>
      </div>
    </form>
  );
}
