'use client';

import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';

export interface RevokeDeviceDialogProps {
  deviceName: string | null;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RevokeDeviceDialog({ deviceName, loading, error, onCancel, onConfirm }: RevokeDeviceDialogProps) {
  return (
    <Dialog
      open={deviceName !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        title={`Révoquer ${deviceName ?? ''} ?`}
        description="Cet appareil sera déconnecté immédiatement. Pour y retrouver votre compte, il faudra s’y reconnecter."
        className="max-w-[440px]"
      >
        <div className="flex flex-col gap-3 p-4">
          {error ? (
            <p role="alert" className="text-body text-fg-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" data-autofocus>
                Annuler
              </Button>
            </DialogClose>
            <Button variant="danger" loading={loading} onClick={onConfirm}>
              Révoquer l’appareil
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
