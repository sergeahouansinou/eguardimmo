'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { sum } from '../money';
import { CommandAlert } from '../parts';
import { selectionSchema } from './schemas';
import type { CreanceOption, CreanceRef } from './creances';

export function OpenDossierDialog({
  title,
  description,
  submitLabel,
  options,
  initial,
  existing,
  money,
  pending,
  error,
  onOpenExisting,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  submitLabel: string;
  options: readonly CreanceOption[];
  initial: readonly string[];
  existing?: { numero: string };
  money: (minor: number) => string;
  pending: boolean;
  error: Error | null;
  onOpenExisting?: () => void;
  onSubmit: (creances: CreanceRef[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(initial));
  const [message, setMessage] = useState<string | undefined>();
  const chosen = options.filter((option) => selected.has(option.key));
  const toggle = (key: string) => {
    setMessage(undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title={title} description={description} className="max-w-[560px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const parsed = selectionSchema.safeParse(chosen.map((option) => option.key));
            if (!parsed.success) {
              setMessage(parsed.error.issues[0]?.message);
              return;
            }
            onSubmit(chosen.map((option) => ({ kind: option.kind, refId: option.refId })));
          }}
        >
          <CommandAlert error={error} />
          {existing ? (
            <Alert tone="info" title={`Le dossier ${existing.numero} est déjà ouvert pour ce bail`}>
              Ouvrez-le, ou ajoutez-y les créances cochées.
            </Alert>
          ) : null}
          {options.length === 0 ? (
            <p className="text-body text-fg-muted">Aucune autre créance en retard n’est disponible pour ce locataire.</p>
          ) : (
            <ul aria-label="Créances en retard" className="flex flex-col rounded-md border border-line">
              {options.map((option) => (
                <li key={option.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-line px-3 py-2 first:border-t-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Checkbox label={option.libelle} checked={selected.has(option.key)} onChange={() => { toggle(option.key); }} />
                    <span className="pl-6 text-caption text-fg-subtle">{option.detail}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <b className="text-fg-danger">{money(option.reste)}</b>
                    <span className="text-caption text-fg-subtle">restant dû</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 text-body">
            <span className="text-fg-muted">
              {chosen.length} créance{chosen.length > 1 ? 's' : ''} sélectionnée{chosen.length > 1 ? 's' : ''}
            </span>
            <span>
              Total sélectionné : <b>{money(sum(chosen.map((option) => option.reste)))}</b>
            </span>
          </p>
          {message ? <p role="alert" className="text-caption text-fg-danger">{message}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            {existing && onOpenExisting ? (
              <Button variant="secondary" onClick={onOpenExisting}>
                Ouvrir le dossier existant
              </Button>
            ) : null}
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
