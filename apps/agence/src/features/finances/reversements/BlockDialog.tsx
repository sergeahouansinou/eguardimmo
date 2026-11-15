"use client";

import { Textarea } from "@eguardimmo/ui";
import { useState } from "react";
import { ActionDialog, useNotify } from "@/features/kit";
import { messageOf } from "@/features/shared/errors";
import { useBlockReversement, useUnblockReversement } from "../hooks";
import { blockSchema } from "../inputs";

export function BlockDialog({ mandantId, name, mode, onClose }: { mandantId: string; name: string; mode: "block" | "unblock" | null; onClose: () => void }) {
  const notify = useNotify();
  const block = useBlockReversement();
  const unblock = useUnblockReversement();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string>();

  const close = () => {
    setReason("");
    setFieldError(undefined);
    block.reset();
    unblock.reset();
    onClose();
  };

  if (mode === null) return null;

  if (mode === "unblock") {
    return (
      <ActionDialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Débloquer le reversement"
        description={`Le reversement de ${name} pourra de nouveau être inclus dans un lot de virements.`}
        confirmLabel="Débloquer le reversement"
        loading={unblock.isPending}
        error={unblock.isError ? messageOf(unblock.error) : null}
        onConfirm={() => {
          unblock.mutate(
            { mandantId },
            {
              onSuccess: () => {
                notify.success("Reversement débloqué", name);
                close();
              },
            },
          );
        }}
      />
    );
  }

  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Bloquer le reversement"
      description={`Le reversement de ${name} sera retiré du lot de virements. Le motif est tracé dans le journal d'audit.`}
      confirmLabel="Bloquer le reversement"
      tone="danger"
      loading={block.isPending}
      error={block.isError ? messageOf(block.error) : null}
      onConfirm={() => {
        const parsed = blockSchema.safeParse({ mandantId, reason });
        if (!parsed.success) {
          setFieldError(parsed.error.issues[0]?.message);
          return;
        }
        setFieldError(undefined);
        block.mutate(parsed.data, {
          onSuccess: () => {
            notify.warning("Reversement bloqué", name);
            close();
          },
        });
      }}
    >
      <Textarea
        label="Motif du blocage"
        placeholder="Mandat à renouveler, IBAN à vérifier, litige en cours…"
        rows={3}
        value={reason}
        error={fieldError}
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
    </ActionDialog>
  );
}
