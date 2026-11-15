"use client";

import { Alert, Button, Dialog, DialogClose, DialogContent, Textarea } from "@eguardimmo/ui";
import { useState } from "react";
import { ActionDialog, DetailList, DialogBody, DialogFooter, useNotify } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact } from "@/features/shared/money";
import { MODE_LABELS } from "../format";
import { useReconcilePayment, useRejectPayment } from "../hooks";
import { rejectPaymentSchema } from "../inputs";
import type { PaymentRow } from "../schemas";
import { PaymentStatusBadge } from "../ui/StatusBadges";

export function PaymentDialog({ payment, onClose }: { payment: PaymentRow | null; onClose: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const reconcile = useReconcilePayment();
  const reject = useRejectPayment();
  const notify = useNotify();

  const close = () => {
    setRejecting(false);
    setReason("");
    setFieldError(undefined);
    reconcile.reset();
    reject.reset();
    onClose();
  };

  if (!payment) return null;

  const doReconcile = () => {
    reconcile.mutate(
      { paymentId: payment.id },
      {
        onSuccess: () => {
          notify.success("Paiement rapproché", `${payment.tenantName}, ${payment.lotLabel} : ${formatMoneyExact(payment.amountMinor)}.`);
          close();
        },
      },
    );
  };

  const doReject = () => {
    const parsed = rejectPaymentSchema.safeParse({ paymentId: payment.id, reason });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    reject.mutate(parsed.data, {
      onSuccess: () => {
        notify.warning("Paiement rejeté", `${formatMoneyExact(payment.amountMinor)} de ${payment.tenantName} sont de nouveau dus.`);
        close();
      },
    });
  };

  if (rejecting) {
    return (
      <ActionDialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Rejeter ce paiement"
        description={`Le paiement de ${formatMoneyExact(payment.amountMinor)} de ${payment.tenantName} sera retiré du reversement de ${payment.mandantName}. Le loyer redevient impayé.`}
        confirmLabel="Rejeter le paiement"
        tone="danger"
        loading={reject.isPending}
        error={reject.isError ? messageOf(reject.error) : null}
        onConfirm={doReject}
      >
        <Textarea
          label="Motif du rejet"
          placeholder="Chèque sans provision, virement rejeté par la banque…"
          value={reason}
          rows={3}
          error={fieldError}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </ActionDialog>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent title={`Paiement de ${payment.tenantName}`} description={`${payment.lotLabel} · ${payment.installmentLabel}`}>
        <DialogBody>
          {reconcile.isError ? <Alert tone="danger">{messageOf(reconcile.error)}</Alert> : null}
          {payment.status === "rejete" ? (
            <Alert tone="danger" title="Paiement rejeté">
              {payment.rejectionReason ?? "Motif non renseigné."}
            </Alert>
          ) : null}
          <DetailList
            items={[
              { label: "État", value: <PaymentStatusBadge status={payment.status} /> },
              { label: "Mandant", value: payment.mandantName },
              { label: "Date de réception", value: formatDate(payment.receivedOn) },
              { label: "Mode", value: MODE_LABELS[payment.mode] },
              { label: "Référence", value: payment.reference || "—" },
              { label: "Montant", value: formatMoneyExact(payment.amountMinor) },
              { label: "Honoraires", value: formatMoneyExact(payment.feeMinor) },
              { label: "Quittance", value: payment.receipt ? "Émise" : "Non émise" },
              { label: "Note", value: payment.note || "—" },
            ]}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Fermer</Button>
          </DialogClose>
          {payment.status !== "rejete" ? (
            <Button
              variant="danger"
              onClick={() => {
                setRejecting(true);
              }}
            >
              Rejeter
            </Button>
          ) : null}
          {payment.status === "a_rapprocher" ? (
            <Button loading={reconcile.isPending} onClick={doReconcile}>
              Rapprocher
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
