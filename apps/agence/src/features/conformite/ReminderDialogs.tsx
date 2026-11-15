"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useMemo, useState } from "react";
import { DialogBody, DialogFooter } from "@/features/kit/ActionDialog";
import { FormCheckCards, FormSelect, useSchemaForm } from "@/features/kit/form";
import { useNotify } from "@/features/kit/notify";
import { splitServerError } from "@/features/kit/serverValidation";
import { formatDate } from "@/features/shared/dates";
import { ALERT_DAY_OPTIONS } from "./logic";
import { useScheduleReminder, useUpdateReminders } from "./queries";
import { CHANNEL_LABELS, CHANNELS, RECIPIENT_OPTIONS, reminderFormSchema, remindersFormSchema } from "./schemas";
import type { Piece, ReminderForm, Reminders, RemindersForm } from "./schemas";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderDialog({ piece, open, onOpenChange }: DialogProps & { piece: Piece }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Programmer un rappel"
        description={`« ${piece.title} » arrive à échéance le ${formatDate(piece.expiresOn)}. Choisissez quand être prévenu.`}
      >
        <ReminderForm
          piece={piece}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ReminderForm({ piece, onDone }: { piece: Piece; onDone: () => void }) {
  const notify = useNotify();
  const schedule = useScheduleReminder();
  const schema = useMemo(() => reminderFormSchema(piece.expiresOn), [piece.expiresOn]);
  const form = useSchemaForm<ReminderForm, ReminderForm>(schema, { on: piece.reminder?.on ?? "", channel: piece.reminder?.channel ?? "both" });
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await schedule.mutateAsync({ id: piece.id, ...values });
      notify.success("Rappel programmé", `Vous serez prévenu le ${formatDate(values.on)}.`);
      onDone();
    } catch (error: unknown) {
      const { fields, message } = splitServerError(error);
      if (fields.on) form.setError("on", { type: "server", message: fields.on });
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
          label="Date du rappel"
          type="date"
          placeholder="jj/mm/aaaa"
          error={form.formState.errors.on?.message}
          {...form.register("on")}
        />
        <FormSelect
          control={form.control}
          name="channel"
          label="Canal"
          placeholder="Choisir un canal"
          options={CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABELS[channel] }))}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={schedule.isPending}>
          Programmer le rappel
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RemindersSettingsDialog({ reminders, open, onOpenChange }: DialogProps & { reminders: Reminders }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Rappels d’échéance" description="Ces alertes s’appliquent à toutes les pièces suivies.">
        <RemindersForm
          reminders={reminders}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RemindersForm({ reminders, onDone }: { reminders: Reminders; onDone: () => void }) {
  const notify = useNotify();
  const update = useUpdateReminders();
  const form = useSchemaForm<RemindersForm, RemindersForm>(remindersFormSchema, {
    days: reminders.days.map(String),
    recipients: [...reminders.recipients],
    channels: [...reminders.channels],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync({ days: values.days.map(Number), recipients: values.recipients, channels: values.channels });
      notify.success("Rappels enregistrés");
      onDone();
    } catch (error: unknown) {
      setFormError(splitServerError(error).message ?? "Les rappels n’ont pas pu être enregistrés.");
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
        <FormCheckCards
          control={form.control}
          name="days"
          legend="Alertes avant l’échéance"
          options={ALERT_DAY_OPTIONS.map((days) => ({ value: String(days), label: `${String(days)} jours avant` }))}
        />
        <FormCheckCards
          control={form.control}
          name="recipients"
          legend="Destinataires"
          options={RECIPIENT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        <FormCheckCards
          control={form.control}
          name="channels"
          legend="Canal"
          options={[
            { value: "email", label: "E-mail" },
            { value: "app", label: "Notification dans l’application" },
          ]}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={update.isPending}>
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
