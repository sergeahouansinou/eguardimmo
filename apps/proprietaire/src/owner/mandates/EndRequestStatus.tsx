"use client";

import { Alert, Button } from "@eguardimmo/ui";
import { useState } from "react";
import { formatDateTime } from "../format";
import { useReturnFocus } from "../shared/ActionDialog";
import { ConfirmAction } from "../shared/ConfirmAction";
import { END_REQUEST_NOTICE } from "./labels";
import type { OwnerMandate } from "./model";
import { useCancelMandateEnd } from "./queries";

export function EndRequestStatus({ mandate, canWrite, onCancelled }: { mandate: OwnerMandate; canWrite: boolean; onCancelled?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const focus = useReturnFocus();
  const cancel = useCancelMandateEnd(mandate.id);
  const request = mandate.endRequest;
  if (request?.status !== "pending") return null;
  return (
    <Alert tone="warning" title="Demande de fin de mandat en cours">
      <span className="flex flex-col items-start gap-2">
        <span>Envoyée le {formatDateTime(request.requestedAt)}.{request.reason === null ? "" : ` Motif indiqué : ${request.reason}`}</span>
        <span>{END_REQUEST_NOTICE}</span>
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              focus.remember(event.currentTarget);
              setConfirming(true);
            }}
          >
            Annuler ma demande
          </Button>
        ) : null}
      </span>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title="Annuler la demande de fin de mandat ?"
        description="Le mandat se poursuit normalement. Vous pourrez faire une nouvelle demande plus tard."
        confirmLabel="Annuler ma demande"
        cancelLabel="Conserver ma demande"
        pending={cancel.isPending}
        error={cancel.isError ? cancel.error : null}
        failureTitle="La demande n’a pas été annulée"
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onConfirm={() => {
          cancel.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false);
              onCancelled?.();
            },
          });
        }}
      />
    </Alert>
  );
}
