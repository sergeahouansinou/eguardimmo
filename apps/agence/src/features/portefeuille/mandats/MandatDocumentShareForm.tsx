"use client";

import { Alert, Button, Select, useToast } from "@eguardimmo/ui";
import { useState } from "react";
import { FileDrop } from "@/features/kit/FileDrop";
import { SHAREABLE_KINDS } from "../api/apiDocuments";
import type { ShareableKind } from "../api/apiDocuments";
import { DOCUMENT_KIND_LABELS, MANDATE_FILE_RULES } from "../mandateFiles";
import type { useMandatDocumentActions } from "../queries";
import type { Mandat } from "../schemas";
import { PortefeuilleError } from "../source";

interface Waiting {
  storedFileId: string;
  fileName: string;
  kind: ShareableKind;
}

const KIND_OPTIONS = SHAREABLE_KINDS.map((value) => ({ value, label: DOCUMENT_KIND_LABELS[value] }));

export function MandatDocumentShareForm({ mandat, actions }: { mandat: Mandat; actions: ReturnType<typeof useMandatDocumentActions> }) {
  const toast = useToast();
  const [kind, setKind] = useState<ShareableKind>("mandate");
  const [file, setFile] = useState<File | null>(null);
  const [failure, setFailure] = useState<string>();
  const [waiting, setWaiting] = useState<Waiting>();
  const busy = actions.upload.isPending || actions.share.isPending;

  const share = async (storedFileId: string, fileName: string, chosen: ShareableKind): Promise<void> => {
    try {
      await actions.share.mutateAsync({ storedFileId, kind: chosen });
      toast.show({ title: "Document partagé", description: `${DOCUMENT_KIND_LABELS[chosen]} · mandat ${mandat.number}` });
      setWaiting(undefined);
      setFile(null);
    } catch (error: unknown) {
      if (error instanceof PortefeuilleError && error.kind === "not_clean") {
        setWaiting({ storedFileId, fileName, kind: chosen });
        setFailure(undefined);
        return;
      }
      setWaiting(undefined);
      setFailure(error instanceof Error ? error.message : "Le partage a échoué.");
    }
  };

  const submit = async (): Promise<void> => {
    setFailure(undefined);
    if (file === null) {
      setFailure("Choisissez le fichier à partager.");
      return;
    }
    let storedFileId: string;
    try {
      storedFileId = await actions.upload.mutateAsync(file);
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error.message : "Le dépôt du fichier a échoué.");
      return;
    }
    await share(storedFileId, file.name, kind);
  };

  return (
    <form
      noValidate
      aria-label="Partager un document avec le mandant"
      className="flex min-w-0 flex-col gap-3 rounded-md border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-body-strong text-fg">Partager un document</h3>
      {failure ? <Alert tone="danger" title="Partage impossible">{failure}</Alert> : null}
      {waiting ? (
        <Alert tone="warning" title="Analyse antivirus en cours">
          <span className="flex flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
            {`« ${waiting.fileName} » est déposé, mais il n'a pas fini son analyse ou n'est pas sain. Il n'est pas encore partagé : réessayez dans un instant.`}
            <Button variant="secondary" size="sm" loading={actions.share.isPending} onClick={() => { void share(waiting.storedFileId, waiting.fileName, waiting.kind); }}>
              Réessayer le partage
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setWaiting(undefined); }}>
              Abandonner
            </Button>
          </span>
        </Alert>
      ) : null}
      <Select label="Nature du document *" placeholder="Choisir une nature, ex. : Diagnostic" options={KIND_OPTIONS} value={kind} onValueChange={(next) => { setKind(KIND_OPTIONS.find((option) => option.value === next)?.value ?? "mandate"); }} />
      <FileDrop
        title="Fichier à partager *"
        hint="PDF, JPG, PNG ou WebP, 10 Mo au maximum. L'avenant signé se joint depuis l'écran d'avenant."
        rules={MANDATE_FILE_RULES}
        file={file}
        onFileChange={(next) => { setFile(next); setFailure(undefined); }}
        browseLabel="Choisir le fichier à partager"
      />
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>Téléverser et partager</Button>
      </div>
    </form>
  );
}
