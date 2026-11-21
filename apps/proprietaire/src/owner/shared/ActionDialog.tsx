"use client";

import { Dialog, DialogContent } from "@eguardimmo/ui";
import { useRef } from "react";
import type { ReactNode } from "react";

export function useReturnFocus() {
  const target = useRef<HTMLElement | null>(null);
  return {
    remember: (element: HTMLElement) => {
      target.current = element;
    },
    onCloseAutoFocus: (event: Event) => {
      if (target.current?.isConnected !== true) return;
      event.preventDefault();
      target.current.focus();
    },
  };
}

export interface ActionDialogProps {
  onCloseAutoFocus?: (event: Event) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
}

export function ActionDialog({ open, onOpenChange, title, description, children, onCloseAutoFocus }: ActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="max-h-[92vh] overflow-y-auto" onCloseAutoFocus={onCloseAutoFocus}>
        <div className="flex flex-col gap-3 p-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
