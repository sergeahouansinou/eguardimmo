'use client';

import { Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { useState } from 'react';
import { useGenerateInstallments } from './hooks';
import { useLeaseChoices } from './useLeaseChoices';
import { errorMessage, useNotify } from '../../locataires/kit';

export function GenerateInstallmentsDialog({ open, onClose, leaseId }: { open: boolean; onClose: () => void; leaseId?: string }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Générer les échéances d’un bail" description="Les périodes déjà générées, même annulées, ne sont jamais refaites." className="max-w-[480px]">
        {open ? <GenerateForm onClose={onClose} leaseId={leaseId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GenerateForm({ onClose, leaseId: preset }: { onClose: () => void; leaseId?: string }) {
  const choices = useLeaseChoices();
  const generate = useGenerateInstallments();
  const notify = useNotify();
  const [leaseId, setLeaseId] = useState(preset ?? '');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async () => {
    if (leaseId === '') {
      setError('Choisissez un bail.');
      return;
    }
    try {
      const outcome = await generate.mutateAsync(leaseId);
      notify({ title: 'Échéances générées', description: `${String(outcome.created)} créée(s), ${String(outcome.existing)} déjà existante(s).` });
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <Select
        label="Bail *"
        placeholder="Choisir un bail, ex. BL-2026-0001"
        options={choices.options}
        value={leaseId}
        onValueChange={(value) => { setLeaseId(value); setError(undefined); }}
        searchable
        searchPlaceholder="Rechercher un bail"
        error={error}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button loading={generate.isPending} onClick={() => { void submit(); }}>Générer</Button>
      </div>
    </div>
  );
}
