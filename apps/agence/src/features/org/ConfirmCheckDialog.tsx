"use client";

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import { useState } from "react";
import type { ReactNode } from "react";
import { DialogBody, DialogFooter } from "@/features/kit";

export interface ConfirmCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  checkLabel: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  children?: ReactNode;
}

function Body({ children, checkLabel, confirmLabel, tone, loading, error, onConfirm }: Omit<ConfirmCheckDialogProps, "open" | "onOpenChange" | "title" | "description">) {
  const [checked, setChecked] = useState(false);
  return (
    <>
      <DialogBody>
        {children}
        <Checkbox
          touch
          label={checkLabel}
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
          }}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" data-autofocus>
            Annuler
          </Button>
        </DialogClose>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading === true} disabled={!checked} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ConfirmCheckDialog({ open, onOpenChange, title, description, ...body }: ConfirmCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <Body {...body} />
      </DialogContent>
    </Dialog>
  );
}
