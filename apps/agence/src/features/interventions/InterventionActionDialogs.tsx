"use client";

import { useState } from "react";
import { ActionDialog, RadioCards, useNotify } from "@/features/kit";
import { messageOf } from "@/features/shared/errors";
import { PRIORITY_LABELS } from "./labels";
import { useSetPriority } from "./queries";
import { PRIORITIES } from "./schemas";
import type { ChangeableStatus, Intervention, Priority } from "./schemas";

export type PendingAction = { kind: "status"; status: ChangeableStatus } | { kind: "priority" };

const CONFIRM_TEXT: Partial<Record<ChangeableStatus, { title: string; description: string; label: string; tone: "primary" | "danger" }>> = {
  terminee: {
    title: "Clôturer l'intervention ?",
    description: "L'intervention passe à l'état « Terminée ». Vous pourrez encore l'archiver ou la rouvrir.",
    label: "Clôturer",
    tone: "primary",
  },
  archivee: {
    title: "Archiver l'intervention ?",
    description: "Elle quitte les interventions terminées et reste consultable dans l'onglet « Archivées ».",
    label: "Archiver",
    tone: "danger",
  },
};

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

interface Props {
  intervention: Intervention;
  pending: PendingAction | null;
  onClose: () => void;
  onStatus: (status: ChangeableStatus) => void;
}

export function InterventionActionDialogs({ intervention, pending, onClose, onStatus }: Props) {
  const status = pending?.kind === "status" ? pending.status : null;
  const text = status ? CONFIRM_TEXT[status] : undefined;
  return (
    <>
      {status && text ? (
        <ActionDialog
          open
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          title={text.title}
          description={`${intervention.subject}, ${intervention.propertyLabel}. ${text.description}`}
          confirmLabel={text.label}
          tone={text.tone}
          onConfirm={() => {
            onStatus(status);
            onClose();
          }}
        />
      ) : null}
      {pending?.kind === "priority" ? <PriorityDialog intervention={intervention} onClose={onClose} /> : null}
    </>
  );
}

function PriorityDialog({ intervention, onClose }: { intervention: Intervention; onClose: () => void }) {
  const notify = useNotify();
  const setPriority = useSetPriority();
  const [priority, setLocal] = useState<Priority>(intervention.priority);
  const [error, setError] = useState<string | null>(null);
  return (
    <ActionDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Changer la priorité"
      description={`${intervention.subject}, ${intervention.propertyLabel}. Priorité actuelle : ${PRIORITY_LABELS[intervention.priority].toLowerCase()}.`}
      confirmLabel="Enregistrer la priorité"
      loading={setPriority.isPending}
      error={error}
      onConfirm={() => {
        setPriority.mutate(
          { id: intervention.id, priority },
          {
            onSuccess: () => {
              notify.success("Priorité modifiée", `« ${intervention.subject} » : ${PRIORITY_LABELS[priority].toLowerCase()}.`);
              onClose();
            },
            onError: (cause) => {
              setError(messageOf(cause));
            },
          },
        );
      }}
    >
      <RadioCards
        legend="Priorité"
        options={PRIORITY_OPTIONS}
        value={priority}
        onValueChange={(value) => {
          setLocal(value as Priority);
        }}
      />
    </ActionDialog>
  );
}
