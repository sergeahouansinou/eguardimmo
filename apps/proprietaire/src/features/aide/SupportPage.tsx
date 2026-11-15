"use client";

import { ContactSupportForm, MyTicketList, MyTicketThread, PageHeader, useSupportStatus } from "@eguardimmo/messagerie";
import { Alert, Badge, Card, CardTitle } from "@eguardimmo/ui";
import { useState } from "react";
import { AIDE_CRUMB } from "./RaccourcisPage";

export function SupportPage() {
  const status = useSupportStatus();
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Discuter avec le support"
        subtitle="Posez votre question : l’équipe vous répond dans les meilleurs délais."
        breadcrumb={[AIDE_CRUMB, { label: "Discuter avec le support" }]}
        actions={
          status.data ? (
            <Badge tone={status.data.online ? "success" : "neutral"}>{status.data.online ? "Support en ligne" : "Support hors ligne"}</Badge>
          ) : null
        }
      />
      {status.isError ? (
        <Alert tone="warning" title="Disponibilité du support inconnue">
          Vous pouvez tout de même écrire : votre demande sera traitée à la réouverture.
        </Alert>
      ) : null}
      {status.data ? (
        <p className="text-body text-fg-muted">
          {status.data.hoursLabel} · {status.data.responseLabel}
        </p>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card role="region" aria-labelledby="support-nouvelle">
          <CardTitle as="h2" id="support-nouvelle">
            Nouvelle demande
          </CardTitle>
          {created ? (
            <Alert tone="success" title="Demande envoyée">
              Votre demande est enregistrée. Retrouvez sa réponse dans « Mes demandes ».
            </Alert>
          ) : null}
          <ContactSupportForm
            onCreated={(id) => {
              setCreated(true);
              setTicketId(id);
            }}
          />
        </Card>
        <Card role="region" aria-labelledby="support-demandes">
          <CardTitle as="h2" id="support-demandes">
            Mes demandes
          </CardTitle>
          {ticketId ? (
            <MyTicketThread ticketId={ticketId} onBack={() => { setTicketId(null); }} />
          ) : (
            <MyTicketList onOpen={setTicketId} />
          )}
        </Card>
      </div>
    </div>
  );
}
