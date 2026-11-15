"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from "@eguardimmo/ui";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";
import { DialogBody, DialogFooter, FormSegmented, SummaryLines, applyServerError, useNotify, useSchemaForm } from "@/features/kit";
import { DEMO_TODAY, addDays, addMonths, formatDate, isIsoDate } from "@/features/shared/dates";
import { formatMoneyExact } from "@/features/shared/money";
import { useProposePlan } from "../hooks";

const planFormSchema = z.object({
  installments: z.enum(["2", "3", "4", "5", "6"]),
  firstDueOn: z
    .string()
    .refine(isIsoDate, "Saisissez une date valide.")
    .refine((value) => value > DEMO_TODAY, "La première échéance doit être postérieure à aujourd'hui."),
});
type PlanFormInput = z.input<typeof planFormSchema>;
type PlanFormValues = z.output<typeof planFormSchema>;

const COUNTS = ["2", "3", "4", "5", "6"].map((value) => ({ value, label: `${value} mois` }));

export interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  remainingMinor: number;
}

export function PlanDialog({ open, onOpenChange, lotId, remainingMinor }: PlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Proposer un échéancier" description={`Étaler les ${formatMoneyExact(remainingMinor)} dus en mensualités. Le plan est proposé au locataire et tracé dans le dossier.`}>
        <PlanForm lotId={lotId} remainingMinor={remainingMinor} onClose={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({ lotId, remainingMinor, onClose }: { lotId: string; remainingMinor: number; onClose: () => void }) {
  const notify = useNotify();
  const propose = useProposePlan();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useSchemaForm<PlanFormInput, PlanFormValues>(planFormSchema, { installments: "2", firstDueOn: addMonths(`${DEMO_TODAY.slice(0, 8)}01`, 1) });
  const installments = useWatch({ control: form.control, name: "installments" });

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    propose.mutate(
      { lotId, installments: Number(values.installments), firstDueOn: values.firstDueOn },
      {
        onSuccess: () => {
          notify.success("Échéancier proposé", `${values.installments} mensualités à partir du ${formatDate(values.firstDueOn)}.`);
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
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <FormSegmented control={form.control} name="installments" label="Nombre de mensualités" options={COUNTS} />
        <TextField label="Première échéance" placeholder="JJ/MM/AAAA" type="date" min={addDays(DEMO_TODAY, 1)} error={form.formState.errors.firstDueOn?.message} {...form.register("firstDueOn")} />
        <SummaryLines
          lines={[
            { label: "Reste dû", value: formatMoneyExact(remainingMinor) },
            { label: `Mensualité estimée sur ${installments} mois`, value: formatMoneyExact(Math.round(remainingMinor / Number(installments))) },
          ]}
        />
        <p className="text-caption text-fg-subtle">Le calendrier définitif est calculé à l'enregistrement.</p>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={propose.isPending}>
          Proposer l'échéancier
        </Button>
      </DialogFooter>
    </form>
  );
}
