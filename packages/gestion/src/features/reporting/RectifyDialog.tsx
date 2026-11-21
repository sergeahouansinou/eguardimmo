'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { REASON_MAX, REASON_MIN } from './api/reportingPayloads';
import { useRectifyReport } from './hooks';
import { periodText } from './labels';
import type { Report } from './model';
import { reportingPaths } from './paths';
import { ActionError } from './parts';
import { noticeAfterNavigation, useGestionNavigation } from '../locataires/kit';

export function RectifyDialog({ report, name, open, onClose }: { report: Report; name: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Rectifier le compte rendu"
        description={`${report.number ?? 'Compte rendu'} de ${name}, ${periodText(report.period)} : un nouveau compte rendu rectificatif remplacera celui-ci, que le mandant verra aussi.`}
        className="max-w-[520px]"
      >
        {open ? <RectifyForm report={report} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RectifyForm({ report, onDone }: { report: Report; onDone: () => void }) {
  const { push } = useGestionNavigation();
  const rectify = useRectifyReport();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const trimmed = reason.trim();
  const valid = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setFailure(null);
    try {
      const created = await rectify.mutateAsync({ id: report.id, reason: trimmed });
      noticeAfterNavigation({ title: 'Rectificatif créé', description: 'Vérifiez-le puis publiez-le pour remplacer le compte rendu précédent.' });
      onDone();
      push(reportingPaths.report(created.id));
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
      <Textarea
        label="Motif de la rectification *"
        rows={4}
        placeholder="Ex. loyer d’octobre imputé au mauvais lot"
        value={reason}
        hint={`${String(REASON_MIN)} à ${String(REASON_MAX)} caractères, repris dans le rectificatif.`}
        error={touched && !valid ? `Indiquez un motif de ${String(REASON_MIN)} à ${String(REASON_MAX)} caractères.` : undefined}
        onChange={(event) => { setReason(event.target.value); }}
        onBlur={() => { setTouched(true); }}
        data-autofocus
      />
      {failure === null ? null : <ActionError title="Rectification impossible" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={rectify.isPending}>Créer le rectificatif</Button>
      </div>
    </form>
  );
}
