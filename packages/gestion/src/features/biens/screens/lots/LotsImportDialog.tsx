'use client';

import { Alert, Button, Dialog, DialogContent } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { FilePicker } from '../../components/FilePicker';
import type { PickedFile } from '../../components/FilePicker';
import { errorMessage, useCommand } from '../../hooks/useCommand';
import { downloadFile } from '../../lib/files';
import { lotsTemplateCsv, parseLotsCsv } from '../../lib/lotCsv';
import type { ParsedLots } from '../../lib/lotCsv';
import { plural } from '../../lib/text';
import type { Currency } from '../../../../format/money';

export function LotsImportDialog({ open, onOpenChange, currency }: { open: boolean; onOpenChange: (open: boolean) => void; currency: Currency }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedLots | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const reset = () => {
    setFileName(null);
    setParsed(null);
    setFailure(null);
  };
  const run = useCommand((source, rows: ParsedLots['rows']) => source.importLots(rows), {
    success: (result) => plural(result.created, 'bien importé', 'biens importés'),
    onDone: () => {
      reset();
      onOpenChange(false);
    },
  });

  const pick = (files: PickedFile[]) => {
    const [first] = files;
    if (!first) return;
    setFailure(null);
    setFileName(first.name);
    first.file.text().then(
      (content) => { setParsed(parseLotsCsv(content, currency)); },
      (error: unknown) => { setFailure(errorMessage(error)); },
    );
  };

  const canImport = parsed !== null && parsed.errors.length === 0 && parsed.rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent title="Importer des lots" description="Fichier CSV séparé par des points-virgules, un lot par ligne.">
        <div className="flex flex-col gap-3 p-4">
          <Button variant="link" className="self-start" onClick={() => { downloadFile('modele-import-lots.csv', lotsTemplateCsv()); }}>
            <Download aria-hidden="true" className="size-4" />
            Télécharger le modèle
          </Button>
          <FilePicker label="Déposer le fichier ici" hint="CSV, 10 Mo au maximum" accept={['.csv']} onPick={pick} />
          {fileName ? <p className="text-body text-fg">{fileName}</p> : null}
          {failure ? <Alert tone="danger" title="Fichier illisible">{failure}</Alert> : null}
          {parsed?.errors.length ? (
            <Alert tone="danger" title="Le fichier contient des erreurs">
              <ul className="list-disc pl-4">
                {parsed.errors.slice(0, 6).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {parsed !== null && parsed.errors.length === 0 ? (
            <Alert tone="success" title={`${plural(parsed.rows.length, 'lot prêt', 'lots prêts')} à importer`}>
              {parsed.rows.slice(0, 3).map((row) => row.name).join(', ')}
              {parsed.rows.length > 3 ? '…' : ''}
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); }}>
              Annuler
            </Button>
            <Button disabled={!canImport} loading={run.isPending} onClick={() => { if (parsed) run.execute(parsed.rows); }}>
              Importer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
