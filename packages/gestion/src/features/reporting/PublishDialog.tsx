'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, RadioGroup, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { usePublishReport, useScheduleReport } from './hooks';
import { periodText } from './labels';
import type { Report } from './model';
import { ActionError } from './parts';
import { useNotify } from '../locataires/kit';

type Mode = 'now' | 'later';

export function PublishDialog({ report, name, open, onClose }: { report: Report; name: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Publier le compte rendu" description={`Compte rendu de ${name}, ${periodText(report.period)}.`} className="max-w-[520px]">
        {open ? <PublishForm report={report} name={name} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PublishForm({ report, name, onDone }: { report: Report; name: string; onDone: () => void }) {
  const notify = useNotify();
  const publish = usePublishReport();
  const schedule = useScheduleReport();
  const [mode, setMode] = useState<Mode>('now');
  const [at, setAt] = useState('');
  const [failure, setFailure] = useState<unknown>(null);
  const [pastAt, setPastAt] = useState(false);
  const pending = publish.isPending || schedule.isPending;

  const submit = async () => {
    setFailure(null);
    if (mode === 'later' && !(at !== '' && Date.parse(at) > Date.now())) {
      setPastAt(true);
      return;
    }
    setPastAt(false);
    try {
      if (mode === 'later') {
        await schedule.mutateAsync({ id: report.id, at });
        notify({ title: 'Publication planifiée', description: `Le compte rendu de ${name} sera publié à la date choisie.` });
      } else {
        const published = await publish.mutateAsync(report.id);
        notify({ title: 'Compte rendu publié', description: `${published.number ?? 'Le compte rendu'} est figé${report.notify ? ' ; le mandant est prévenu' : ''}.` });
      }
      onDone();
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <Alert tone="warning" title="Publication définitive">
        Le compte rendu reçoit son numéro, son PDF est scellé et il n’est plus modifiable : une erreur se corrige par un compte rendu rectificatif.
      </Alert>
      <RadioGroup
        label="Quand publier"
        value={mode}
        onValueChange={(value) => { setMode(value === 'later' ? 'later' : 'now'); }}
        options={[
          { value: 'now', label: 'Publier maintenant' },
          { value: 'later', label: 'Planifier la publication' },
        ]}
      />
      {mode === 'later' ? (
        <TextField
          label="Date et heure de publication"
          type="datetime-local"
          placeholder="AAAA-MM-JJ hh:mm"
          value={at}
          error={pastAt ? 'Choisissez une date et une heure dans le futur.' : undefined}
          onChange={(event) => { setAt(event.target.value); }}
        />
      ) : null}
      {failure === null ? null : <ActionError title="Publication impossible" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>{mode === 'later' ? 'Planifier' : 'Publier'}</Button>
      </div>
    </form>
  );
}
