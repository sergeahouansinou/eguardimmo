'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, Textarea } from '@eguardimmo/ui';
import { CommandAlert, FilePicker } from '../parts';
import type { Pret } from '../schemas';
import { parseSchedule } from './schedule';
import type { ScheduleLine } from './schedule';

const MAX_TEXT_BYTES = 1024 * 1024;

export function ImportDialog({
  open,
  prets,
  initialId,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  prets: readonly Pret[];
  initialId: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: { pretId: string; lignes: ScheduleLine[] }) => void;
  onClose: () => void;
}) {
  const [pretId, setPretId] = useState(initialId);
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const loadFile = (file: File) => {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setFileError('Format non pris en charge : CSV ou texte uniquement.');
      return;
    }
    if (file.size > MAX_TEXT_BYTES) {
      setFileError('Fichier trop volumineux : 1 Mo au maximum.');
      return;
    }
    setFileError(null);
    void file.text().then(setText);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent title="Importer un échéancier" description="Collez ou chargez le tableau d’amortissement de la banque : une ligne par échéance." className="max-w-[600px]">
        <form
          noValidate
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pretId) {
              setProblems(['Choisissez le prêt concerné.']);
              return;
            }
            const parsed = parseSchedule(text);
            setProblems(parsed.errors);
            if (parsed.errors.length === 0) onSubmit({ pretId, lignes: parsed.lignes });
          }}
        >
          <CommandAlert error={error} />
          <Select label="Prêt concerné" placeholder="Choisir un prêt" options={prets.map((pret) => ({ value: pret.id, label: `${pret.bien}, ${pret.banque}` }))} value={pretId} onValueChange={setPretId} />
          <Textarea label="Échéancier" placeholder={'15/12/2026;1012,00;160,89;851,11;131 000,00'} hint="Colonnes séparées par « ; » : date, mensualité, intérêts, capital, restant dû." rows={6} value={text} onChange={(event) => { setText(event.target.value); }} />
          <div className="flex flex-wrap items-center gap-2">
            <FilePicker label="Charger un fichier CSV" accept=".csv,.txt,text/csv,text/plain" onPick={loadFile} />
            {fileError ? <span className="text-caption text-fg-danger">{fileError}</span> : null}
          </div>
          {problems.length > 0 ? (
            <Alert tone="danger" title="Import impossible">
              <ul className="list-disc pl-4">
                {problems.slice(0, 5).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Importer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
