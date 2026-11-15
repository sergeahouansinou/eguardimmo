"use client";

import { Alert, Button, Select, TextField } from "@eguardimmo/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { FormSelect, FormSwitch, FormTextarea, LinkButton, PageFrame, SummaryLines, useNotify, useSchemaForm } from "@/features/kit";
import { DEMO_TODAY, formatDate } from "@/features/shared/dates";
import { DemoServerError, messageOf } from "@/features/shared/errors";
import { formatMoney, formatMoneyExact, parseMoney } from "@/features/shared/money";
import { MODE_LABELS, csvAmount } from "../format";
import { newKey, useOpenInstallments, usePaymentPreview, useRecordPayment } from "../hooks";
import type { OpenInstallment } from "../schemas";
import { paymentFormSchema } from "./paymentForm";
import type { PaymentFormInput, PaymentFormValues } from "./paymentForm";

const MODE_OPTIONS = Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }));

export function PaymentFormPage() {
  const query = useOpenInstallments();
  const lotParam = useSearchParams().get("lot");
  return (
    <QueryState query={query} label="Le formulaire de paiement">
      {(items) => <PaymentForm items={items} lotParam={lotParam} />}
    </QueryState>
  );
}

function PaymentForm({ items, lotParam }: { items: readonly OpenInstallment[]; lotParam: string | null }) {
  const router = useRouter();
  const notify = useNotify();
  const record = useRecordPayment();
  const [idempotencyKey] = useState(() => newKey("paiement"));
  const [formError, setFormError] = useState<string | null>(null);
  const initial = items.find((item) => item.lotId === lotParam);
  const form = useSchemaForm<PaymentFormInput, PaymentFormValues>(paymentFormSchema, {
    lotId: initial?.lotId ?? "",
    installmentId: initial?.installmentId ?? "",
    amount: initial ? csvAmount(initial.remainingMinor) : "",
    receivedOn: DEMO_TODAY,
    mode: "virement",
    reference: "",
    note: "",
    receipt: true,
    notifyTenant: true,
    notifyMandant: false,
  });
  const { control, register, setValue, setError, formState } = form;
  const [lotId, installmentId, amount, receivedOn] = useWatch({ control, name: ["lotId", "installmentId", "amount", "receivedOn"] });
  const amountMinor = parseMoney(amount) ?? 0;
  const preview = usePaymentPreview(installmentId && amountMinor > 0 ? { installmentId, amountMinor, receivedOn } : null);

  const lotOptions = [...new Map(items.map((item) => [item.lotId, item])).values()].map((item) => ({
    value: item.lotId,
    label: `${item.tenantName}, ${item.lotLabel}`,
    description: `${formatMoneyExact(item.remainingMinor)} dus`,
  }));
  const installmentOptions = items
    .filter((item) => item.lotId === lotId)
    .map((item) => ({ value: item.installmentId, label: `${item.label}, ${formatMoneyExact(item.remainingMinor)}`, description: `Échéance du ${formatDate(item.dueOn)}` }));
  const selected = items.find((item) => item.installmentId === installmentId);

  const chooseLot = (next: string) => {
    const first = items.find((item) => item.lotId === next);
    setValue("lotId", next, { shouldValidate: formState.isSubmitted });
    setValue("installmentId", first?.installmentId ?? "", { shouldValidate: formState.isSubmitted });
    setValue("amount", first ? csvAmount(first.remainingMinor) : "", { shouldValidate: formState.isSubmitted });
  };

  const chooseInstallment = (next: string) => {
    const item = items.find((candidate) => candidate.installmentId === next);
    setValue("installmentId", next, { shouldValidate: formState.isSubmitted });
    if (item) setValue("amount", csvAmount(item.remainingMinor), { shouldValidate: formState.isSubmitted });
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    record.mutate(
      {
        idempotencyKey,
        installmentId: values.installmentId,
        amountMinor: parseMoney(values.amount) ?? 0,
        receivedOn: values.receivedOn,
        mode: values.mode,
        reference: values.reference,
        note: values.note,
        receipt: values.receipt,
        notifyTenant: values.notifyTenant,
        notifyMandant: values.notifyMandant,
      },
      {
        onSuccess: (result) => {
          notify.success("Paiement enregistré", `${formatMoneyExact(parseMoney(values.amount) ?? 0)} reçus${result.closedCase ? ". L'impayé est clos." : "."}`);
          router.push("/finances/encaissements");
        },
        onError: (error) => {
          if (!(error instanceof DemoServerError) || Object.keys(error.fieldErrors).length === 0) {
            setFormError(messageOf(error));
            return;
          }
          const targets: Record<string, "amount" | "receivedOn" | "installmentId"> = { amountMinor: "amount", receivedOn: "receivedOn", installmentId: "installmentId" };
          Object.entries(error.fieldErrors).forEach(([field, message]) => {
            const target = targets[field];
            if (target) setError(target, { type: "server", message });
            else setFormError(message);
          });
        },
      },
    );
  });

  const previewData = preview.data;
  const amountFieldError = formState.errors.amount?.message ?? (amountMinor > 0 && previewData?.error ? previewData.error : undefined);

  return (
    <PageFrame
      crumbs={[{ label: "Encaissements", href: "/finances/encaissements" }, { label: "Saisir un paiement" }]}
      title="Saisir un paiement reçu"
      description="Le paiement est rattaché à un bail et à une échéance. Les honoraires et le reversement sont recalculés."
    >
      {lotParam && !initial ? (
        <Alert tone="info" title="Aucune échéance ouverte pour ce lot">
          Ce lot n'a plus de loyer à encaisser. Choisissez un autre locataire.
        </Alert>
      ) : null}
      {formError ? (
        <Alert tone="danger" title="Le paiement n'a pas été enregistré">
          {formError}
        </Alert>
      ) : null}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SectionCard title="Paiement">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <Controller
                control={control}
                name="lotId"
                render={({ field, fieldState }) => (
                  <Select label="Locataire *" placeholder="Choisir un locataire" searchable searchPlaceholder="Rechercher un locataire" options={lotOptions} value={field.value} onValueChange={chooseLot} error={fieldState.error?.message} />
                )}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Montant reçu, € *" placeholder="450,00" inputMode="decimal" autoComplete="off" error={amountFieldError} {...register("amount")} />
                <TextField label="Date de réception *" placeholder="JJ/MM/AAAA" type="date" max={DEMO_TODAY} error={formState.errors.receivedOn?.message} {...register("receivedOn")} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormSelect control={control} name="mode" label="Mode de paiement" placeholder="Choisir un mode" options={MODE_OPTIONS} />
                <TextField label="Référence bancaire" placeholder="VIR 13/11 ROUX STUDIO 4" autoComplete="off" error={formState.errors.reference?.message} {...register("reference")} />
              </div>
              <Controller
                control={control}
                name="installmentId"
                render={({ field, fieldState }) => (
                  <Select label="Affecter à" placeholder="Choisir une échéance" options={installmentOptions} value={field.value} onValueChange={chooseInstallment} disabled={lotId === ""} error={fieldState.error?.message} />
                )}
              />
              <FormTextarea control={control} name="note" label="Note" placeholder="Virement reçu sur le compte des mandants le 13/11." rows={3} />
            </div>
          </SectionCard>
          <div className="flex flex-col gap-3">
            <SectionCard title="Après l'enregistrement">
              <div className="flex flex-col gap-3 px-4 pb-4">
                {previewData && !previewData.error ? (
                  <>
                    <Alert tone={previewData.closesCase ? "success" : "info"}>
                      {`Reste dû de ${formatMoneyExact(previewData.remainingAfterMinor)}. ${previewData.closesCase ? `L'impayé de ${previewData.lotLabel} sera clos.` : previewData.remainingAfterMinor > 0 ? `L'échéance de ${previewData.lotLabel} restera ouverte.` : ""}`}
                    </Alert>
                    <SummaryLines
                      lines={[
                        { label: "Honoraires retenus", value: formatMoneyExact(previewData.feeMinor) },
                        { label: `À reverser à ${previewData.mandantName}`, value: formatMoneyExact(previewData.netMinor) },
                      ]}
                    />
                  </>
                ) : (
                  <p className="text-body text-fg-subtle">
                    {selected ? `Saisissez le montant reçu pour voir l'impact sur le reversement de ${selected.mandantName} (reste dû ${formatMoney(selected.remainingMinor)}).` : "Choisissez un locataire et saisissez le montant pour voir l'impact sur les honoraires et le reversement."}
                  </p>
                )}
              </div>
            </SectionCard>
            <SectionCard title="Options">
              <div className="px-4 pb-3">
                <FormSwitch control={control} name="receipt" label="Émettre la quittance" />
                <FormSwitch control={control} name="notifyTenant" label="Informer le locataire par e-mail" />
                <FormSwitch control={control} name="notifyMandant" label="Informer le mandant" />
              </div>
            </SectionCard>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href="/finances/encaissements" variant="ghost">
            Annuler
          </LinkButton>
          <Button type="submit" loading={record.isPending}>
            Enregistrer le paiement
          </Button>
        </div>
      </form>
    </PageFrame>
  );
}
