"use client";

import { Alert, Badge, Button, EmptyState, SegmentedControl } from "@eguardimmo/ui";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { DataTable, PageFrame, useNotify } from "@/features/kit";
import type { Column } from "@/features/kit";
import { ConfirmCheckDialog } from "@/features/org/ConfirmCheckDialog";
import { errorMessage } from "@/features/org/errors";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { todayIso } from "@/features/org/today";
import { formatDate, formatDateTime } from "@/features/shared/dates";
import { deadlineStatus } from "./deadline";
import { useMarkHandled, usePrivacyRequests } from "./hooks";
import { IRREVERSIBLE_KINDS, KIND_HELP, KIND_LABELS } from "./labels";
import type { PrivacyRequest } from "./schemas";

type Filter = "open" | "handled" | "all";

const FILTERS = [
  { value: "open", label: "À traiter" },
  { value: "handled", label: "Traitées" },
  { value: "all", label: "Toutes" },
] as const;

function inFilter(request: PrivacyRequest, filter: Filter): boolean {
  if (filter === "open") return !request.handled;
  if (filter === "handled") return request.handled;
  return true;
}

function columns(onHandle: (request: PrivacyRequest) => void, today: string): readonly Column<PrivacyRequest>[] {
  return [
    {
      id: "requester",
      header: "Demandeur",
      role: "title",
      cell: (request) => (
        <span className="flex flex-col">
          <span>{request.requesterName}</span>
          <span className="text-caption font-normal text-fg-subtle">{request.requesterEmail}</span>
        </span>
      ),
    },
    {
      id: "kind",
      header: "Droit exercé",
      cell: (request) => <Badge tone={IRREVERSIBLE_KINDS.includes(request.kind) ? "warning" : "neutral"}>{KIND_LABELS[request.kind]}</Badge>,
    },
    { id: "forwarded", header: "Reçue le", cell: (request) => formatDate(request.forwardedAt) },
    {
      id: "deadline",
      header: "Échéance",
      cell: (request) => {
        if (request.handled) return formatDate(request.deadline);
        const status = deadlineStatus(request.deadline, today);
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            {formatDate(request.deadline)}
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Statut",
      role: "status",
      cell: (request) => (request.handled && request.handledAt !== null ? <Badge tone="success">Traitée le {formatDateTime(request.handledAt)}</Badge> : <Badge tone="info">À traiter</Badge>),
    },
    {
      id: "action",
      header: "Action",
      role: "action",
      hideHeader: true,
      cell: (request) =>
        request.handled ? null : (
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              onHandle(request);
            }}
          >
            Marquer comme traitée
            <span className="sr-only">, demande de {request.requesterName}</span>
          </Button>
        ),
    },
  ];
}

export function PrivacyRequestsPage() {
  const requests = usePrivacyRequests();
  const markHandled = useMarkHandled();
  const notify = useNotify();
  const [filter, setFilter] = useState<Filter>("open");
  const [target, setTarget] = useState<PrivacyRequest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (open) return;
    setTarget(null);
    setFailure(null);
  };

  const confirm = async () => {
    if (target === null) return;
    setFailure(null);
    try {
      await markHandled.mutateAsync(target.id);
      notify.success("Demande marquée comme traitée", target.requesterName);
      setTarget(null);
    } catch (error: unknown) {
      setFailure(errorMessage(error));
    }
  };

  const visible = (requests.data ?? []).filter((request) => inFilter(request, filter));

  return (
    <PageFrame
      crumbs={[{ label: "Réglages" }, { label: "Demandes RGPD" }]}
      title="Demandes RGPD"
      description="Demandes d’exercice de droits sur des données personnelles que la plateforme vous a transmises. Vous les traitez avec vos propres outils, puis vous les marquez comme traitées."
    >
      <Alert tone="info" title="Ce que fait cet écran">
        Il liste les demandes et enregistre que vous les avez traitées. Il ne supprime ni ne modifie aucune donnée à votre place.
      </Alert>
      {requests.isError ? (
        <QueryFailure error={requests.error} label="Les demandes RGPD" onRetry={requests.refetch} />
      ) : requests.isPending || requests.data === undefined ? (
        <LoadingPanel label="Les demandes RGPD" />
      ) : (
        <>
          <SegmentedControl label="Filtrer les demandes" options={FILTERS} value={filter} onValueChange={(value) => { setFilter(value === "handled" || value === "all" ? value : "open"); }} />
          {visible.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={filter === "open" ? "Aucune demande à traiter" : "Aucune demande"}
              description={requests.data.length === 0 ? "Aucune demande ne vous a été transmise." : "Aucune demande ne correspond à ce filtre."}
            />
          ) : (
            <DataTable caption="Demandes RGPD transmises" columns={columns(setTarget, todayIso())} rows={visible} getRowId={(request) => request.id} />
          )}
          {requests.moreError ? <Alert tone="danger" title="La suite n’a pas pu être chargée">{requests.moreError.message}</Alert> : null}
          {requests.hasMore ? (
            <div>
              <Button variant="secondary" loading={requests.isFetchingMore} onClick={requests.fetchMore}>
                Afficher plus de demandes
              </Button>
            </div>
          ) : null}
        </>
      )}
      <ConfirmCheckDialog
        open={target !== null}
        onOpenChange={close}
        title="Marquer cette demande comme traitée ?"
        description={target === null ? "" : `Demande de ${target.requesterName} : ${KIND_LABELS[target.kind].toLowerCase()}.`}
        checkLabel="Je confirme avoir traité cette demande dans mes outils"
        confirmLabel="Marquer comme traitée"
        tone={target !== null && IRREVERSIBLE_KINDS.includes(target.kind) ? "danger" : "primary"}
        loading={markHandled.isPending}
        error={failure}
        onConfirm={() => {
          void confirm();
        }}
      >
        {target === null ? null : (
          <div className="flex flex-col gap-2 text-body text-fg-muted">
            <p>{KIND_HELP[target.kind]}</p>
            {IRREVERSIBLE_KINDS.includes(target.kind) ? (
              <Alert tone="warning" title="Suppression ou anonymisation">
                Confirmez seulement si les données de cette personne ont été supprimées ou anonymisées dans vos outils, dans la limite de vos obligations de conservation. La plateforme n’efface rien à votre place.
              </Alert>
            ) : null}
            <p>Cette action est définitive : une demande marquée comme traitée ne peut plus être rouverte, et la plateforme en est informée.</p>
          </div>
        )}
      </ConfirmCheckDialog>
    </PageFrame>
  );
}
