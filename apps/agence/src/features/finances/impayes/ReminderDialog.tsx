"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { useState } from "react";
import { DialogBody, DialogFooter, FormRadioCards, FormTextarea, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import type { Option } from "@/features/kit";
import { plural } from "../format";
import { useSendReminders } from "../hooks";
import { reminderSchema } from "../inputs";

const reminderFormSchema = reminderSchema.pick({ channel: true, message: true });
interface ReminderFormInput {
  channel: "email" | "sms" | "courrier";
  message: string;
}

const CHANNEL_OPTIONS: readonly Option[] = [
  { value: "email", label: "E-mail", description: "Rappel amiable avec le grand livre du locataire" },
  { value: "sms", label: "SMS", description: "Message court sur le téléphone du locataire" },
  { value: "courrier", label: "Courrier", description: "Lettre simple, expédiée sous 48 h" },
];

const DEFAULT_MESSAGE = "Bonjour, sauf erreur de notre part, votre loyer reste à régler. Merci de procéder au règlement dans les meilleurs délais.";

export interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotIds: readonly string[];
  recipients: readonly string[];
  onSent?: () => void;
}

export function ReminderDialog({ open, onOpenChange, ...props }: ReminderDialogProps) {
  const count = props.lotIds.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={count > 1 ? "Relancer la sélection" : "Envoyer une relance"}
        description={count > 1 ? `${plural(count, "relance sera envoyée", "relances seront envoyées")}, tracées dans chaque dossier.` : "La relance est tracée dans le dossier de l'impayé."}
      >
        <ReminderForm {...props} onClose={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function ReminderForm({ lotIds, recipients, onSent, onClose }: Omit<ReminderDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const notify = useNotify();
  const send = useSendReminders();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useSchemaForm<ReminderFormInput, ReminderFormInput>(reminderFormSchema, { channel: "email", message: DEFAULT_MESSAGE });

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    send.mutate(
      { lotIds: [...lotIds], ...values },
      {
        onSuccess: ({ sent }) => {
          notify.success(sent > 1 ? `${String(sent)} relances envoyées` : "Relance envoyée", recipients.join(", "));
          onSent?.();
          onClose();
        },
        onError: (error) => {
          setFormError(applyServerError(form.setError, error));
        },
      },
    );
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogBody>
        <p className="text-body text-fg-muted">
          <b className="font-semibold text-fg">{plural(recipients.length, "destinataire", "destinataires")} : </b>
          {recipients.join(", ")}
        </p>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <FormRadioCards control={form.control} name="channel" legend="Canal d'envoi" options={CHANNEL_OPTIONS} />
        <FormTextarea control={form.control} name="message" label="Message" placeholder="Bonjour, votre loyer de novembre reste à régler…" rows={4} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={send.isPending}>
          {lotIds.length > 1 ? `Envoyer ${String(lotIds.length)} relances` : "Envoyer la relance"}
        </Button>
      </DialogFooter>
    </form>
  );
}
