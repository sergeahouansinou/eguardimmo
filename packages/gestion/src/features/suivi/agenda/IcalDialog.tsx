'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useScreenQuery } from '../../outils/kit';
import { ICAL_KEY, useAgendaSource } from './source';

type CopyState = 'idle' | 'copied' | 'failed';

const urlSchema = z.url();

function IcalBody() {
  const source = useAgendaSource();
  const query = useScreenQuery(ICAL_KEY, source.icalUrl, urlSchema);
  const [copy, setCopy] = useState<CopyState>('idle');

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-body text-fg-muted">
        Ajoutez ce lien dans Google Agenda, Apple Calendrier ou Outlook pour suivre vos événements. Ne le partagez pas : toute personne qui le détient voit votre agenda.
      </p>
      {query.isError ? (
        <Alert tone="danger" title="Le lien n’a pas pu être généré">
          <Button variant="link" size="sm" onClick={query.refetch}>Réessayer</Button>
        </Alert>
      ) : null}
      <TextField
        label="Lien iCal"
        placeholder="Lien en cours de génération"
        readOnly
        value={query.data ?? ''}
        onFocus={(event) => { event.target.select(); }}
      />
      {copy === 'copied' ? <Alert tone="success">Lien copié dans le presse-papiers.</Alert> : null}
      {copy === 'failed' ? <Alert tone="danger">La copie automatique a échoué : sélectionnez le lien puis copiez-le manuellement.</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="secondary">Fermer</Button>
        </DialogClose>
        <Button
          disabled={query.data === undefined}
          onClick={() => {
            if (query.data !== undefined) void copyLink(query.data);
          }}
        >
          Copier le lien
        </Button>
      </div>
    </div>
  );
}

export function IcalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Lien iCal" description="Abonnement à l’agenda" className="max-w-lg">
        <IcalBody />
      </DialogContent>
    </Dialog>
  );
}
