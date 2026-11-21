"use client";

import { Alert, Button, Textarea } from "@eguardimmo/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyLabel, formatDay } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { useReturnFocus } from "../shared/ActionDialog";
import { ConfirmAction } from "../shared/ConfirmAction";
import { useWriteAccess } from "../shared/useWriteAccess";
import { EndRequestStatus } from "./EndRequestStatus";
import { END_REQUEST_NOTICE } from "./labels";
import { REASON_MAX } from "./model";
import type { OwnerMandate } from "./model";
import { useMandate, useRequestMandateEnd } from "./queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BackLink() {
  return (
    <div>
      <Button asChild variant="secondary">
        <Link href={confieRoutes.mandat}>Retour à mon mandat</Link>
      </Button>
    </div>
  );
}

function EndForm({ mandate, onSent }: { mandate: OwnerMandate; onSent: () => void }) {
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const focus = useReturnFocus();
  const request = useRequestMandateEnd(mandate.id);
  const trimmed = reason.trim();

  const review = (event: { currentTarget: HTMLElement }) => {
    if (trimmed.length > REASON_MAX) {
      setProblem(`Le motif ne peut pas dépasser ${String(REASON_MAX)} caractères.`);
      return;
    }
    setProblem(undefined);
    focus.remember(event.currentTarget);
    setConfirming(true);
  };

  return (
    <>
      <Section title="Votre demande">
        <div className="flex flex-col gap-3">
          <Textarea
            label="Motif (facultatif)"
            placeholder="Expliquez en quelques mots votre demande"
            maxLength={REASON_MAX}
            value={reason}
            error={problem}
            hint={`${String(REASON_MAX)} caractères au maximum.`}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <div>
            <Button onClick={review}>Demander la fin du mandat</Button>
          </div>
        </div>
      </Section>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title="Demander la fin du mandat ?"
        description={`${END_REQUEST_NOTICE} Vous pourrez annuler cette demande tant qu’elle n’est pas traitée.`}
        confirmLabel="Envoyer la demande"
        pending={request.isPending}
        error={request.isError ? request.error : null}
        failureTitle="Votre demande n’a pas été enregistrée"
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onConfirm={() => {
          request.mutate(trimmed === "" ? null : trimmed, {
            onSuccess: () => {
              setConfirming(false);
              setReason("");
              onSent();
            },
          });
        }}
      />
    </>
  );
}

function Content({ mandate }: { mandate: OwnerMandate }) {
  const access = useWriteAccess(mandate.agency.id);
  const pending = mandate.endRequest?.status === "pending";
  const [sent, setSent] = useState(false);
  return (
    <>
      <PageHeader
        title="Demander la fin du mandat"
        crumbs={[{ label: "Mon agence", href: confieRoutes.agence }, { label: `Mandat ${mandate.reference}`, href: confieRoutes.mandat }, { label: "Fin du mandat" }]}
        subtitle={`Mandat ${mandate.reference} · ${agencyLabel(mandate.agency.name)}`}
      />
      <Section title="Mandat concerné">
        <DataList
          width="lg"
          items={[
            { label: "Période", value: `Depuis le ${formatDay(mandate.startsOn)}${mandate.endDate === null ? "" : `, jusqu’au ${formatDay(mandate.endDate)}`}` },
            { label: "Préavis prévu", value: mandate.noticeMonths === null ? NOT_AVAILABLE : `${String(mandate.noticeMonths)} mois` },
          ]}
        />
      </Section>
      {sent ? (
        <Alert tone="success" title="Demande envoyée à votre agence">
          {END_REQUEST_NOTICE}
        </Alert>
      ) : null}
      {pending ? <EndRequestStatus mandate={mandate} canWrite={access.canWrite} /> : null}
      {!pending && mandate.status !== "active" ? (
        <Alert tone="info" title="Ce mandat n’est plus en cours">
          Une demande de fin n’est possible que sur un mandat en cours.
        </Alert>
      ) : null}
      {!pending && mandate.status === "active" && !access.canWrite ? (
        <Alert tone="info" title="Lecture seule">
          {access.inGrace ? "Votre mandat est terminé : vous ne pouvez plus faire de demande depuis votre espace." : "Seul le titulaire du mandat ou son représentant peut demander la fin du mandat."}
        </Alert>
      ) : null}
      {!pending && mandate.status === "active" && access.canWrite ? (
        <EndForm
          mandate={mandate}
          onSent={() => {
            setSent(true);
          }}
        />
      ) : null}
      <BackLink />
    </>
  );
}

export function MandateEndScreen() {
  const requested = useSearchParams().get("mandat");
  const id = requested !== null && UUID.test(requested) ? requested : null;
  const query = useMandate(id);
  if (id === null) {
    return (
      <>
        <PageHeader title="Demander la fin du mandat" crumbs={[{ label: "Mon agence", href: confieRoutes.agence }, { label: "Mon mandat", href: confieRoutes.mandat }, { label: "Fin du mandat" }]} />
        <Alert tone="info" title="Aucun mandat sélectionné">
          Choisissez le mandat concerné depuis la page « Mon mandat ».
        </Alert>
        <BackLink />
      </>
    );
  }
  if (query.isPending) return <Loading label="Chargement du mandat" />;
  if (query.isError) return <FailureNotice title="Le mandat n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />;
  return <Content mandate={query.data} />;
}
