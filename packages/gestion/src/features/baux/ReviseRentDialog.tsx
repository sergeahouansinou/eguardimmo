'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useReviseRent } from './hooks';
import type { Lease } from './schemas';
import { errorMessage, useNotify } from '../locataires/kit';
import { euroInput, money } from '../locataires/kit/money';

export function ReviseRentDialog({ lease, onClose }: { lease: Lease | null; onClose: () => void }) {
  return (
    <Dialog open={lease !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent title="Réviser le loyer" description={lease ? `${lease.reference}, loyer actuel ${money(lease.rent)} hors charges.` : undefined}>
        {lease ? <ReviseRentForm key={lease.id} lease={lease} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReviseRentForm({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const revise = useReviseRent();
  const notify = useNotify();
  const [value, setValue] = useState(euroInput(lease.rent));
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setError(undefined);
    try {
      const updated = await revise.mutateAsync({ leaseId: lease.id, rent: value });
      notify({ title: 'Loyer révisé', description: `${updated.reference}, nouveau loyer ${money(updated.rent)}.` });
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <TextField
        label="Nouveau loyer hors charges (€) *"
        placeholder="Ex. 865 ou 865,50"
        inputMode="decimal"
        value={value}
        error={error}
        onChange={(event) => { setValue(event.target.value); setError(undefined); }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button loading={revise.isPending} onClick={() => { void submit(); }}>Réviser le loyer</Button>
      </div>
    </div>
  );
}
