import { Alert, Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 px-4 pt-2 pb-3">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{children}</div>;
}

export interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  children?: ReactNode;
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "primary",
  loading = false,
  error,
  onConfirm,
  children,
}: ActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {children || error ? (
          <DialogBody>
            {children}
            {error ? <Alert tone="danger">{error}</Alert> : null}
          </DialogBody>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </DialogClose>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
