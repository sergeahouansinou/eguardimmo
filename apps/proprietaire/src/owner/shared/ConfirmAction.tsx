"use client";

import { Button } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { ActionFailure } from "../security/ActionFailure";
import { ActionDialog } from "./ActionDialog";

export interface ConfirmActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  pending: boolean;
  error: unknown;
  failureTitle: string;
  onConfirm: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "primary",
  pending,
  error,
  failureTitle,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmActionProps) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={title}
      description={description}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {error === null || error === undefined ? null : <ActionFailure error={error} title={failureTitle} retryable />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          data-autofocus
          onClick={() => {
            onOpenChange(false);
          }}
        >
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ActionDialog>
  );
}
