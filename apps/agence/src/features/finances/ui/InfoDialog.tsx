import { Button, Dialog, DialogClose, DialogContent } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { DialogBody, DialogFooter } from "@/features/kit";

export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel = "Fermer",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  closeLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {children ? <DialogBody>{children}</DialogBody> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" data-autofocus>
              {closeLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
