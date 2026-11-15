"use client";

import { Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "primary",
  pending = false,
  error = null,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <div className="flex flex-col gap-3 p-4">
          {error ? <p role="alert" className="text-body text-fg-danger">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" data-autofocus>{cancelLabel}</Button>
            </DialogClose>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
