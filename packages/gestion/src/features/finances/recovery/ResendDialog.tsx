'use client';

import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { ValiditySelect } from './ValiditySelect';

export interface ResendDialogProps {
  open: boolean;
  recipientEmail: string;
  days: string;
  loading: boolean;
  onDaysChange: (days: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ResendDialog({ open, recipientEmail, days, loading, onDaysChange, onConfirm, onClose }: ResendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Renvoyer un lien ?" description={`Un nouveau lien est envoyé à ${recipientEmail}. L’ancien lien est révoqué.`} className="max-w-[480px]">
        {open ? (
          <div className="flex flex-col gap-3 p-4">
            <ValiditySelect value={days} onChange={onDaysChange} />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Retour</Button>
              </DialogClose>
              <Button loading={loading} onClick={onConfirm}>Renvoyer le lien</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
