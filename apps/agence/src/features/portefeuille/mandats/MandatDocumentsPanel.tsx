"use client";

import { Alert, Badge, Button, ConfirmDialog, Skeleton, useToast } from "@eguardimmo/ui";
import { useState } from "react";
import { formatDay } from "@/lib/dates";
import type { MandatDocument } from "../api/apiDocuments";
import { useMandatDocuments, useMandatDocumentActions } from "../queries";
import { DOCUMENT_KIND_LABELS } from "../mandateFiles";
import type { Mandat } from "../schemas";
import { MandatDocumentShareForm } from "./MandatDocumentShareForm";

const dayOf = (timestamp: string): string => formatDay(timestamp.slice(0, 10));

function StatusBadge({ document }: { document: MandatDocument }) {
  if (document.revokedAtIso !== null) return <Badge tone="neutral">{`Retiré le ${dayOf(document.revokedAtIso)}`}</Badge>;
  return <Badge tone="success">Partagé avec le mandant</Badge>;
}

export function MandatDocumentsPanel({ mandat, canWrite }: { mandat: Mandat; canWrite: boolean }) {
  const documents = useMandatDocuments(mandat.id);
  const actions = useMandatDocumentActions(mandat.id);
  const toast = useToast();
  const [removing, setRemoving] = useState<MandatDocument>();
  const editable = canWrite && !mandat.archived;

  if (documents.isError) {
    return (
      <Alert tone="danger" title="Les documents du mandat n'ont pas pu être chargés">
        <span className="flex flex-wrap items-center gap-2">
          Vérifiez votre connexion puis réessayez.
          <Button variant="secondary" size="sm" onClick={documents.refetch}>Réessayer</Button>
        </span>
      </Alert>
    );
  }
  if (documents.isPending || documents.data === undefined) {
    return (
      <div role="status" aria-label="Chargement : documents du mandat" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton shape="block" className="h-24" />
      </div>
    );
  }
  const items = documents.data;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-caption text-fg-subtle">Documents que l&apos;agence partage avec le mandant. Retirer un partage ne supprime pas le fichier.</p>
      {items.length === 0 ? (
        <p role="note" className="py-2 text-body text-fg-subtle">Aucun document partagé avec le mandant pour le moment.</p>
      ) : (
        <ul aria-label="Documents partagés avec le mandant" className="flex min-w-0 flex-col divide-y divide-line">
          {items.map((document) => (
            <li key={document.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <b className="text-body font-medium text-fg [overflow-wrap:anywhere]">{DOCUMENT_KIND_LABELS[document.kind]}</b>
                <span className="text-caption text-fg-subtle">
                  {`${document.uploadedBy === "agency" ? "Ajouté par l'agence" : "Ajouté par le mandant"}, partagé le ${document.sharedAtIso === null ? "—" : dayOf(document.sharedAtIso)}`}
                </span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge document={document} />
                {editable ? (
                  document.kind === "amendment" || document.revokedAtIso !== null ? (
                    <span className="text-caption text-fg-subtle">{document.kind === "amendment" ? "Non retirable" : "—"}</span>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => { setRemoving(document); }}>
                      {`Retirer le partage : ${DOCUMENT_KIND_LABELS[document.kind]}`}
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable ? <MandatDocumentShareForm mandat={mandat} actions={actions} /> : null}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setRemoving(undefined); }}
          title="Retirer le partage"
          description={`Le mandant ne verra plus ce document (${DOCUMENT_KIND_LABELS[removing.kind]}). Le fichier reste conservé par l'agence.`}
          confirmLabel="Retirer le partage"
          tone="danger"
          loading={actions.unshare.isPending}
          onConfirm={() => {
            const target = removing;
            actions.unshare.mutate(target.id, {
              onSuccess: () => {
                toast.show({ title: "Partage retiré", description: `Mandat ${mandat.number}` });
                setRemoving(undefined);
              },
              onError: (error) => {
                setRemoving(undefined);
                toast.show({ tone: "danger", title: "Le retrait a échoué", description: error.message });
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
