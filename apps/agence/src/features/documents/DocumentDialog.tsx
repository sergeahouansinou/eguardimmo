"use client";

import { Alert, Badge, Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { useState } from "react";
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import { DialogBody, DialogFooter } from "@/features/kit/ActionDialog";
import { DetailList } from "@/features/kit/Details";
import { useNotify } from "@/features/kit/notify";
import { splitServerError } from "@/features/kit/serverValidation";
import { SwitchRow } from "@/features/kit/SwitchRow";
import { formatDate } from "@/features/shared/dates";
import { formatFileSize } from "@/features/shared/files";
import { attachmentLabel, sharingPill } from "./labels";
import { useArchiveDocument, useUpdateSharing } from "./queries";
import { AGENCY_OWNER } from "./schemas";
import type { DocumentRecord } from "./schemas";

export interface DocumentDialogProps {
  document: DocumentRecord | null;
  onClose: () => void;
  onArchive: (document: DocumentRecord) => void;
}

export function DocumentDialog({ document, onClose, onArchive }: DocumentDialogProps) {
  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {document ? (
        <DialogContent title={document.displayName} description={`${document.category} · ${attachmentLabel(document)}`}>
          <DocumentDetail key={document.id} document={document} onClose={onClose} onArchive={onArchive} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DocumentDetail({ document, onClose, onArchive }: { document: DocumentRecord; onClose: () => void; onArchive: (document: DocumentRecord) => void }) {
  const notify = useNotify();
  const download = useDemoDownload();
  const archive = useArchiveDocument();
  const sharing = useUpdateSharing();
  const [editing, setEditing] = useState(false);
  const [mandant, setMandant] = useState(document.sharedWithMandant);
  const [tenant, setTenant] = useState(document.sharedWithTenant);
  const [error, setError] = useState<string | null>(null);
  const pill = sharingPill(document);

  const saveSharing = () => {
    setError(null);
    sharing.mutate(
      { id: document.id, sharedWithMandant: mandant, sharedWithTenant: tenant },
      {
        onSuccess: () => {
          notify.success("Partage modifié", `« ${document.displayName} » : ${sharingPill({ sharedWithMandant: mandant, sharedWithTenant: tenant }).label.toLowerCase()}.`);
          setEditing(false);
        },
        onError: (failure) => {
          setError(splitServerError(failure).message ?? Object.values(splitServerError(failure).fields).join(" "));
        },
      },
    );
  };

  const unarchive = () => {
    archive.mutate(
      { id: document.id, archived: false },
      {
        onSuccess: () => {
          notify.success("Document désarchivé", `« ${document.displayName} » est de nouveau actif.`);
          onClose();
        },
        onError: (failure) => {
          setError(splitServerError(failure).message ?? "Le document n’a pas pu être désarchivé.");
        },
      },
    );
  };

  if (editing) {
    return (
      <>
        <DialogBody>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <SwitchRow
            label="Visible par le mandant"
            checked={mandant}
            onCheckedChange={setMandant}
            disabled={document.ownerId === AGENCY_OWNER}
            hint={document.ownerId === AGENCY_OWNER ? "Un document de l’agence n’a pas de mandant." : undefined}
          />
          <SwitchRow
            label="Visible par le locataire"
            checked={tenant}
            onCheckedChange={setTenant}
            disabled={document.lotId === null}
            hint={document.lotId === null ? "Rattachez le document à un bien pour le partager avec le locataire." : "Un document interne reste visible par l’équipe de l’agence seulement."}
          />
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false);
              setMandant(document.sharedWithMandant);
              setTenant(document.sharedWithTenant);
            }}
          >
            Annuler
          </Button>
          <Button loading={sharing.isPending} onClick={saveSharing}>
            Enregistrer le partage
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogBody>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <DetailList
          items={[
            { label: "Fichier", value: document.fileName },
            { label: "Rattaché à", value: attachmentLabel(document) },
            { label: "Catégorie", value: document.category },
            { label: "Partage", value: <Badge tone={pill.tone}>{pill.label}</Badge> },
            { label: "Taille", value: formatFileSize(document.sizeBytes) },
            { label: "Ajouté le", value: formatDate(document.date) },
            ...(document.validUntil ? [{ label: "Valable jusqu’au", value: formatDate(document.validUntil) }] : []),
            ...(document.description ? [{ label: "Description", value: document.description }] : []),
            ...(document.archived ? [{ label: "État", value: "Archivé" }] : []),
          ]}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Fermer</Button>
        </DialogClose>
        <Button
          variant="secondary"
          onClick={() => {
            download(document.fileName);
          }}
        >
          Télécharger
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(true);
          }}
        >
          Modifier le partage
        </Button>
        {document.archived ? (
          <Button variant="secondary" loading={archive.isPending} onClick={unarchive}>
            Désarchiver
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              onArchive(document);
            }}
          >
            Archiver
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
