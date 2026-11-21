"use client";

import { Alert, Button } from "@eguardimmo/ui";
import { useState } from "react";
import { formatDay } from "@/lib/dates";
import { useMandatEndRequest, usePortefeuilleAccess } from "../queries";
import type { MandatEndRequest } from "../source";
import { DismissEndRequestDialog } from "./DismissEndRequestDialog";

const dayOf = (timestamp: string): string => formatDay(timestamp.slice(0, 10));
const filled = (text: string | null): text is string => text !== null && text.trim() !== "";

export function EndRequestNotice({ mandateId, mandateNumber }: { mandateId: string; mandateNumber: string }) {
  const state = useMandatEndRequest(mandateId);
  if (state.kind === "disabled" || state.kind === "loading" || state.kind === "absent") return null;
  if (state.kind === "unverifiable") {
    return (
      <Alert tone="warning" title="Demande de fin de mandat non vérifiée">
        <span className="flex flex-wrap items-center gap-2">
          Le serveur n’a pas pu dire si le propriétaire a demandé la fin de ce mandat.
          <Button variant="link" size="sm" onClick={state.retry}>Réessayer</Button>
        </span>
      </Alert>
    );
  }
  return <RequestNotice request={state.request} mandateId={mandateId} mandateNumber={mandateNumber} />;
}

function Reason({ request }: { request: MandatEndRequest }) {
  if (!filled(request.reason)) return null;
  return (
    <span className="whitespace-pre-line break-words">
      <span className="font-medium">Motif indiqué : </span>
      {request.reason}
    </span>
  );
}

function RequestNotice({ request, mandateId, mandateNumber }: { request: MandatEndRequest; mandateId: string; mandateNumber: string }) {
  const { canWrite } = usePortefeuilleAccess();
  const [dismissing, setDismissing] = useState(false);

  if (request.status === "pending") {
    return (
      <Alert tone="warning" title={`Le propriétaire a demandé la fin du mandat le ${dayOf(request.requestedAt)}`}>
        <span className="flex flex-col gap-2">
          <Reason request={request} />
          <span>Cette demande ne change rien au mandat : à traiter avec le propriétaire. La résiliation reste à votre initiative.</span>
          {canWrite ? (
            <span>
              <Button variant="secondary" size="sm" onClick={() => { setDismissing(true); }}>Classer sans suite</Button>
              <DismissEndRequestDialog mandateId={mandateId} mandateNumber={mandateNumber} open={dismissing} onOpenChange={setDismissing} />
            </span>
          ) : null}
        </span>
      </Alert>
    );
  }

  if (request.status === "dismissed") {
    return (
      <Alert tone="info" title={`Demande de fin de mandat classée sans suite${request.decidedAt === null ? "" : ` le ${dayOf(request.decidedAt)}`}`}>
        <span className="flex flex-col gap-1">
          <span>Demande du propriétaire du {dayOf(request.requestedAt)} : le mandat se poursuit.</span>
          <Reason request={request} />
          {filled(request.decisionNote) ? (
            <span className="whitespace-pre-line break-words">
              <span className="font-medium">Note de l’agence : </span>
              {request.decisionNote}
            </span>
          ) : null}
        </span>
      </Alert>
    );
  }

  if (request.status === "fulfilled") {
    return (
      <Alert tone="info" title={`Demande de fin de mandat satisfaite${request.decidedAt === null ? "" : ` le ${dayOf(request.decidedAt)}`}`}>
        <span className="flex flex-col gap-1">
          <span>Le mandat a été résilié à la suite de la demande du propriétaire du {dayOf(request.requestedAt)}.</span>
          <Reason request={request} />
        </span>
      </Alert>
    );
  }

  return (
    <Alert tone="info" title={`Le propriétaire a retiré sa demande de fin de mandat${request.cancelledAt === null ? "" : ` le ${dayOf(request.cancelledAt)}`}`}>
      <span className="flex flex-col gap-1">
        <span>Demande du {dayOf(request.requestedAt)} : le mandat se poursuit, rien à traiter.</span>
        <Reason request={request} />
      </span>
    </Alert>
  );
}
